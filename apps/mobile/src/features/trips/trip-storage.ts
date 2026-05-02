import { formatDistanceKm } from "@gigeze/shared";
import { mobileStorage } from "../../lib/storage/mobile-storage";
import type { BackendTripSummary, DeletedBackendTrip } from "./mobile-sync/sync-client";
import { getCompletedTripDistanceKilometers, isValidDistanceKm } from "./trip-distance";
import {
  getTripSyncDiagnostics,
  finalizeTripDelete,
  markTripDeleted,
  markTripDeleteFailed,
  markTripDeleteSynced,
  markTripSyncFailed,
  stageTripDelete,
  undoTripDelete,
  updateTripMetadata,
  type MobileTripSession,
  type TripDeletionSyncState,
  type TripMetadataUpdate,
  type TripSyncDiagnostics,
  type TripSyncState,
} from "./trip-workflow";

const recentTripsLimit = 20;

function activeTripKey(userId: string) {
  return `gigeze.mobile.trips.${userId}.active`;
}

function recentTripsKey(userId: string) {
  return `gigeze.mobile.trips.${userId}.recent`;
}

function normalizeSyncState(status: MobileTripSession["status"], syncState: unknown, backendTripId?: string): TripSyncState {
  if (status === "completed" && backendTripId && (syncState === undefined || syncState === null || syncState === "localOnly")) {
    return "synced";
  }

  if (status === "completed" && (syncState === undefined || syncState === null || syncState === "localOnly")) {
    return "pendingSync";
  }

  if (
    syncState === "localOnly" ||
    syncState === "pendingSync" ||
    syncState === "syncing" ||
    syncState === "synced" ||
    syncState === "syncFailed"
  ) {
    return syncState;
  }

  return "localOnly";
}

function normalizeDeletionSyncState(deletedAt: string | undefined, syncState: unknown, backendTripId?: string): TripDeletionSyncState {
  if (!deletedAt) {
    return "notDeleted";
  }

  if (!backendTripId) {
    return "deleted";
  }

  if (
    syncState === "pendingUndo" ||
    syncState === "pendingDelete" ||
    syncState === "deleting" ||
    syncState === "deleted" ||
    syncState === "deleteFailed"
  ) {
    return syncState;
  }

  return "pendingDelete";
}

function normalizeTrip(parsed: Partial<MobileTripSession>, expectedStatus: MobileTripSession["status"]): MobileTripSession | null {
  if (!parsed.id || !parsed.startedAt || parsed.status !== expectedStatus) {
    return null;
  }

  return {
    ...parsed,
    tripMode: parsed.tripMode === "WALK" || parsed.tripMode === "RIDE" || parsed.tripMode === "DRIVE" ? parsed.tripMode : "DRIVE",
    title: parsed.title ?? "Trip",
    sampleCount: parsed.sampleCount ?? 0,
    captureMode: parsed.captureMode ?? "manual",
    syncState: normalizeSyncState(parsed.status, parsed.syncState, parsed.backendTripId),
    deletionSyncState: normalizeDeletionSyncState(parsed.deletedAt, parsed.deletionSyncState, parsed.backendTripId),
    createdAt: parsed.createdAt ?? parsed.startedAt,
    updatedAt: parsed.updatedAt ?? parsed.endedAt ?? parsed.startedAt,
  } as MobileTripSession;
}

function parseTrip(value: string | null): MobileTripSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<MobileTripSession>;
    return normalizeTrip(parsed, "active");
  } catch {
    return null;
  }
}

function parseTripList(value: string | null): MobileTripSession[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<MobileTripSession>[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((trip) => normalizeTrip(trip, "completed"))
      .filter((trip): trip is MobileTripSession => Boolean(trip));
  } catch {
    return [];
  }
}

export type TripStorageSnapshot = {
  hasActiveTrip: boolean;
  recentTripsCount: number;
  syncDiagnostics: TripSyncDiagnostics;
};

export type PendingUndoDelete = {
  tripId: string;
  title: string;
  message: string;
  undoExpiresAt: string;
};

const deletedTripBannerSecondaryMaxLength = 24;

function formatDeletedTripDate(startedAt: string) {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function compactBannerText(value: string) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  if (normalizedValue.length <= deletedTripBannerSecondaryMaxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, deletedTripBannerSecondaryMaxLength - 1).trimEnd()}…`;
}

export function formatDeletedTripSummary(trip: Pick<MobileTripSession, "startedAt" | "distanceMeters" | "backendDistanceKm" | "vehicleName">) {
  const dateLabel = formatDeletedTripDate(trip.startedAt);
  if (!dateLabel) {
    return "Trip deleted";
  }

  const distanceKm = getCompletedTripDistanceKilometers(trip as MobileTripSession);
  if (typeof distanceKm === "number" && distanceKm > 0) {
    return `Trip deleted · ${dateLabel} · ${formatDistanceKm(distanceKm)}`;
  }

  if (trip.vehicleName?.trim()) {
    return `Trip deleted · ${dateLabel} · ${compactBannerText(trip.vehicleName)}`;
  }

  return `Trip deleted · ${dateLabel}`;
}

function visibleTrips(trips: MobileTripSession[]) {
  return trips.filter((trip) => !trip.deletedAt);
}

function prepareStoredTrips(trips: MobileTripSession[]) {
  const visible = visibleTrips(trips).slice(0, recentTripsLimit);
  const tombstones = trips.filter((trip) => trip.deletedAt);
  return [...visible, ...tombstones];
}

function sortCompletedTripsForStorage(trips: MobileTripSession[]) {
  return [...trips].sort((left, right) => {
    const leftTime = new Date(left.startedAt).getTime();
    const rightTime = new Date(right.startedAt).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function getDateMs(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function getRemoteDistanceMeters(remoteTrip: BackendTripSummary) {
  return isValidDistanceKm(remoteTrip.backendDistanceKm) ? Math.round(remoteTrip.backendDistanceKm * 1000) : undefined;
}

function isCloseTripDistance(localTrip: MobileTripSession, remoteTrip: BackendTripSummary) {
  const remoteDistanceMeters = getRemoteDistanceMeters(remoteTrip);
  if (remoteDistanceMeters === undefined) {
    return true;
  }

  const localDistanceMeters = Math.max(localTrip.distanceMeters ?? 0, Math.round((localTrip.backendDistanceKm ?? 0) * 1000));
  if (localDistanceMeters <= 0) {
    return true;
  }

  return Math.abs(localDistanceMeters - remoteDistanceMeters) <= Math.max(1000, localDistanceMeters * 0.2);
}

function isLikelySameBackendTrip(localTrip: MobileTripSession, remoteTrip: BackendTripSummary) {
  if (localTrip.backendTripId || localTrip.deletedAt) {
    return false;
  }

  const localStartedAt = getDateMs(localTrip.startedAt);
  const localEndedAt = getDateMs(localTrip.endedAt);
  const remoteStartedAt = getDateMs(remoteTrip.startedAt ?? remoteTrip.date);
  const remoteEndedAt = getDateMs(remoteTrip.endedAt ?? remoteTrip.startedAt ?? remoteTrip.date);

  if (
    localStartedAt === undefined ||
    localEndedAt === undefined ||
    remoteStartedAt === undefined ||
    remoteEndedAt === undefined
  ) {
    return false;
  }

  const remoteTripMode = remoteTrip.tripMode ?? "DRIVE";
  if (localTrip.tripMode !== remoteTripMode) {
    return false;
  }

  if (localTrip.vehicleId && remoteTrip.vehicleId && localTrip.vehicleId !== remoteTrip.vehicleId) {
    return false;
  }

  const timeToleranceMs = 2 * 60 * 1000;
  return (
    Math.abs(localStartedAt - remoteStartedAt) <= timeToleranceMs &&
    Math.abs(localEndedAt - remoteEndedAt) <= timeToleranceMs &&
    isCloseTripDistance(localTrip, remoteTrip)
  );
}

function mergeRemoteSummaryIntoLocalTrip(localTrip: MobileTripSession, remoteTrip: BackendTripSummary): MobileTripSession {
  const startedAt = remoteTrip.startedAt ?? remoteTrip.date ?? localTrip.startedAt;
  const endedAt = remoteTrip.endedAt ?? remoteTrip.startedAt ?? remoteTrip.date ?? localTrip.endedAt;
  const updatedAt = remoteTrip.updatedAt ?? localTrip.updatedAt;

  return {
    ...localTrip,
    backendTripId: remoteTrip.backendTripId,
    backendDistanceKm: remoteTrip.backendDistanceKm ?? localTrip.backendDistanceKm,
    vehicleId: remoteTrip.vehicleId ?? localTrip.vehicleId,
    vehicleName: remoteTrip.vehicleName ?? localTrip.vehicleName,
    tripMode: remoteTrip.tripMode ?? localTrip.tripMode,
    tripPurpose: remoteTrip.tripPurpose ?? localTrip.tripPurpose,
    purpose: remoteTrip.purpose ?? localTrip.purpose,
    startLocation: remoteTrip.startLocation ?? localTrip.startLocation,
    endLocation: remoteTrip.endLocation ?? localTrip.endLocation,
    startedAt,
    endedAt,
    startOdometer: remoteTrip.startOdometer ?? localTrip.startOdometer,
    endOdometer: remoteTrip.endOdometer ?? localTrip.endOdometer,
    syncState: "synced",
    lastSyncError: undefined,
    lastSyncSucceededAt: updatedAt,
    updatedAt,
  };
}

function mapStoredBackendTripToSummary(trip: MobileTripSession): BackendTripSummary | null {
  if (!trip.backendTripId) {
    return null;
  }

  return {
    backendTripId: trip.backendTripId,
    journeyId: trip.journeyId,
    journeyTitle: trip.journeyTitle,
    tripMode: trip.tripMode,
    vehicleId: trip.vehicleId,
    vehicleName: trip.vehicleName,
    tripPurpose: trip.tripPurpose,
    purpose: trip.purpose,
    startLocation: trip.startLocation,
    endLocation: trip.endLocation,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    startOdometer: trip.startOdometer,
    endOdometer: trip.endOdometer,
    backendDistanceKm: trip.backendDistanceKm ?? getCompletedTripDistanceKilometers(trip),
    updatedAt: trip.updatedAt,
  };
}

function reconcileStoredBackendDuplicates(trips: MobileTripSession[]) {
  const removedTripIds = new Set<string>();
  let changed = false;
  const nextTrips = trips.map((trip) => {
    if (trip.backendTripId || trip.deletedAt) {
      return trip;
    }

    const duplicateBackendTrip = trips.find((candidate) => {
      if (
        !candidate.backendTripId ||
        candidate.deletedAt ||
        candidate.id === trip.id ||
        removedTripIds.has(candidate.id)
      ) {
        return false;
      }

      const remoteSummary = mapStoredBackendTripToSummary(candidate);
      return remoteSummary ? isLikelySameBackendTrip(trip, remoteSummary) : false;
    });

    if (!duplicateBackendTrip) {
      return trip;
    }

    const remoteSummary = mapStoredBackendTripToSummary(duplicateBackendTrip);
    if (!remoteSummary) {
      return trip;
    }

    removedTripIds.add(duplicateBackendTrip.id);
    changed = true;
    return mergeRemoteSummaryIntoLocalTrip(trip, remoteSummary);
  });

  return {
    changed,
    trips: nextTrips.filter((trip) => !removedTripIds.has(trip.id)),
  };
}

function mapRemoteSummaryToCompletedTrip(userId: string, remoteTrip: BackendTripSummary): MobileTripSession | null {
  const startedAt = remoteTrip.startedAt ?? remoteTrip.date;
  if (!startedAt) {
    return null;
  }

  const endedAt = remoteTrip.endedAt ?? startedAt;
  const updatedAt = remoteTrip.updatedAt ?? endedAt;
  const distanceMeters = isValidDistanceKm(remoteTrip.backendDistanceKm) ? Math.round(remoteTrip.backendDistanceKm * 1000) : 0;

  return {
    id: `backend-${remoteTrip.backendTripId}`,
    userId,
    status: "completed",
    startedAt,
    endedAt,
    distanceMeters,
    title: "Trip",
    sampleCount: 0,
    captureMode: "manual",
    syncState: "synced",
    lastSyncSucceededAt: updatedAt,
    backendTripId: remoteTrip.backendTripId,
    backendDistanceKm: isValidDistanceKm(remoteTrip.backendDistanceKm) ? remoteTrip.backendDistanceKm : undefined,
    journeyId: remoteTrip.journeyId,
    journeyTitle: remoteTrip.journeyTitle,
    tripMode: remoteTrip.tripMode ?? "DRIVE",
    vehicleId: remoteTrip.vehicleId,
    vehicleName: remoteTrip.vehicleName,
    tripPurpose: remoteTrip.tripPurpose,
    purpose: remoteTrip.purpose,
    startLocation: remoteTrip.startLocation,
    endLocation: remoteTrip.endLocation,
    startOdometer: remoteTrip.startOdometer,
    endOdometer: remoteTrip.endOdometer,
    createdAt: startedAt,
    updatedAt,
  };
}

export const tripStorage = {
  async getActiveTrip(userId: string) {
    return parseTrip(await mobileStorage.getItem(activeTripKey(userId)));
  },
  async saveActiveTrip(userId: string, trip: MobileTripSession) {
    await mobileStorage.setItem(activeTripKey(userId), JSON.stringify(trip));
  },
  async clearActiveTrip(userId: string) {
    await mobileStorage.removeItem(activeTripKey(userId));
  },
  async listStoredTrips(userId: string) {
    return parseTripList(await mobileStorage.getItem(recentTripsKey(userId)));
  },
  async saveStoredTrips(userId: string, trips: MobileTripSession[]) {
    const nextTrips = prepareStoredTrips(trips);
    await mobileStorage.setItem(recentTripsKey(userId), JSON.stringify(nextTrips));
    return nextTrips;
  },
  async listRecentTrips(userId: string) {
    return visibleTrips(await this.listStoredTrips(userId));
  },
  async saveCompletedTrip(userId: string, trip: MobileTripSession) {
    const trips = await this.listStoredTrips(userId);
    const matchingTombstone = trips.find((recentTrip) =>
      recentTrip.deletedAt && (recentTrip.id === trip.id || (trip.backendTripId && recentTrip.backendTripId === trip.backendTripId)),
    );

    if (matchingTombstone && !trip.deletedAt) {
      return visibleTrips(trips);
    }

    const nextTrips = await this.saveStoredTrips(userId, [trip, ...trips.filter((recentTrip) => recentTrip.id !== trip.id)]);
    return visibleTrips(nextTrips);
  },
  async updateCompletedTrip(userId: string, trip: MobileTripSession) {
    return this.saveCompletedTrip(userId, trip);
  },
  async updateCompletedTripMetadata(userId: string, tripId: string, metadata: TripMetadataUpdate, updatedAt = new Date().toISOString()) {
    const trips = await this.listStoredTrips(userId);
    const nextTrips = await this.saveStoredTrips(
      userId,
      trips.map((trip) => (trip.id === tripId ? updateTripMetadata(trip, metadata, updatedAt) : trip)),
    );
    return visibleTrips(nextTrips);
  },
  async getPendingUndoDelete(userId: string): Promise<PendingUndoDelete | null> {
    const pendingTrip = (await this.listStoredTrips(userId))
      .filter((trip) => trip.deletionSyncState === "pendingUndo" && trip.deleteUndoExpiresAt)
      .sort((left, right) => (right.deleteUndoExpiresAt ?? "").localeCompare(left.deleteUndoExpiresAt ?? ""))[0];

    if (!pendingTrip?.deleteUndoExpiresAt) {
      return null;
    }

    return {
      tripId: pendingTrip.id,
      title: pendingTrip.title,
      message: formatDeletedTripSummary(pendingTrip),
      undoExpiresAt: pendingTrip.deleteUndoExpiresAt,
    };
  },
  async stageCompletedTripDelete(userId: string, tripId: string, undoExpiresAt: string, deletedAt = new Date().toISOString()) {
    const trips = await this.listStoredTrips(userId);
    const nextTrips = await this.saveStoredTrips(
      userId,
      trips.map((trip) => (trip.id === tripId ? stageTripDelete(trip, undoExpiresAt, deletedAt) : trip)),
    );
    return visibleTrips(nextTrips);
  },
  async deleteCompletedTrip(userId: string, tripId: string, deletedAt = new Date().toISOString()) {
    const trips = await this.listStoredTrips(userId);
    const nextTrips = await this.saveStoredTrips(
      userId,
      trips.map((trip) => (trip.id === tripId ? markTripDeleted(trip, deletedAt) : trip)),
    );
    return visibleTrips(nextTrips);
  },
  async finalizeCompletedTripDelete(userId: string, tripId: string, finalizedAt = new Date().toISOString()) {
    const trips = await this.listStoredTrips(userId);
    const nextTrips = await this.saveStoredTrips(
      userId,
      trips.map((trip) => (trip.id === tripId ? finalizeTripDelete(trip, finalizedAt) : trip)),
    );
    return visibleTrips(nextTrips);
  },
  async undoCompletedTripDelete(userId: string, tripId: string, restoredAt = new Date().toISOString()) {
    const trips = await this.listStoredTrips(userId);
    const nextTrips = await this.saveStoredTrips(
      userId,
      trips.map((trip) => (trip.id === tripId && trip.deletionSyncState === "pendingUndo" ? undoTripDelete(trip, restoredAt) : trip)),
    );
    return visibleTrips(nextTrips);
  },
  async applyRemoteDeletedTrips(userId: string, deletedTrips: DeletedBackendTrip[]) {
    if (deletedTrips.length === 0) {
      return this.listRecentTrips(userId);
    }

    const deletedByBackendId = new Map(deletedTrips.map((trip) => [trip.backendTripId, trip.deletedAt]));
    const trips = await this.listStoredTrips(userId);
    let changed = false;
    const nextTrips = trips.map((trip) => {
      const deletedAt = trip.backendTripId ? deletedByBackendId.get(trip.backendTripId) : undefined;
      if (!deletedAt) {
        return trip;
      }

      changed = true;
      return markTripDeleteSynced(trip, deletedAt);
    });

    if (!changed) {
      return visibleTrips(trips);
    }

    return visibleTrips(await this.saveStoredTrips(userId, nextTrips));
  },
  async applyRemoteTripSummaries(userId: string, remoteTrips: BackendTripSummary[]) {
    if (remoteTrips.length === 0) {
      return this.listRecentTrips(userId);
    }

    const remoteByBackendId = new Map(remoteTrips.map((trip) => [trip.backendTripId, trip]));
    const storedTrips = await this.listStoredTrips(userId);
    const reconciledStoredTrips = reconcileStoredBackendDuplicates(storedTrips);
    const trips = reconciledStoredTrips.trips;
    const localBackendIds = new Set(trips.flatMap((trip) => (trip.backendTripId ? [trip.backendTripId] : [])));
    const deletedBackendIds = new Set(trips.flatMap((trip) => (trip.deletedAt && trip.backendTripId ? [trip.backendTripId] : [])));
    const consumedRemoteBackendIds = new Set<string>();
    let changed = reconciledStoredTrips.changed;
    const updatedTrips = trips.map((trip) => {
      if (trip.deletedAt) {
        return trip;
      }

      const remoteTrip = trip.backendTripId ? remoteByBackendId.get(trip.backendTripId) : undefined;
      if (!remoteTrip) {
        const matchingRemoteTrip = remoteTrips.find((candidate) =>
          !localBackendIds.has(candidate.backendTripId) &&
          !deletedBackendIds.has(candidate.backendTripId) &&
          !consumedRemoteBackendIds.has(candidate.backendTripId) &&
          isLikelySameBackendTrip(trip, candidate),
        );

        if (!matchingRemoteTrip) {
          return trip;
        }

        consumedRemoteBackendIds.add(matchingRemoteTrip.backendTripId);
        changed = true;
        return mergeRemoteSummaryIntoLocalTrip(trip, matchingRemoteTrip);
      }

      if (trip.syncState === "pendingSync" || trip.syncState === "syncing") {
        return trip;
      }

      consumedRemoteBackendIds.add(remoteTrip.backendTripId);
      changed = true;
      return {
        ...trip,
        vehicleId: remoteTrip.vehicleId ?? undefined,
        vehicleName: remoteTrip.vehicleName ?? undefined,
        tripMode: remoteTrip.tripMode ?? trip.tripMode,
        tripPurpose: remoteTrip.tripPurpose ?? trip.tripPurpose,
        purpose: remoteTrip.purpose ?? trip.purpose,
        startLocation: remoteTrip.startLocation ?? trip.startLocation,
        endLocation: remoteTrip.endLocation ?? trip.endLocation,
        startedAt: remoteTrip.startedAt ?? remoteTrip.date ?? trip.startedAt,
        endedAt: remoteTrip.endedAt ?? remoteTrip.startedAt ?? remoteTrip.date ?? trip.endedAt,
        startOdometer: remoteTrip.startOdometer ?? trip.startOdometer,
        endOdometer: remoteTrip.endOdometer ?? trip.endOdometer,
        backendDistanceKm: remoteTrip.backendDistanceKm ?? trip.backendDistanceKm,
        syncState: "synced" as const,
        lastSyncError: undefined,
        lastSyncSucceededAt: remoteTrip.updatedAt ?? trip.lastSyncSucceededAt,
        updatedAt: remoteTrip.updatedAt ?? trip.updatedAt,
      };
    });
    const importedTrips = remoteTrips.flatMap((remoteTrip) => {
      if (
        localBackendIds.has(remoteTrip.backendTripId) ||
        deletedBackendIds.has(remoteTrip.backendTripId) ||
        consumedRemoteBackendIds.has(remoteTrip.backendTripId)
      ) {
        return [];
      }

      const importedTrip = mapRemoteSummaryToCompletedTrip(userId, remoteTrip);
      if (!importedTrip) {
        return [];
      }

      changed = true;
      return [importedTrip];
    });

    if (!changed) {
      return visibleTrips(trips);
    }

    return visibleTrips(await this.saveStoredTrips(userId, sortCompletedTripsForStorage([...updatedTrips, ...importedTrips])));
  },
  async listPendingSyncTrips(userId: string) {
    const trips = await this.listStoredTrips(userId);
    return trips.filter((trip) => {
      if (trip.deletedAt) {
        return trip.deletionSyncState === "pendingDelete" || trip.deletionSyncState === "deleteFailed" || trip.deletionSyncState === "deleting";
      }

      return trip.syncState === "pendingSync" || trip.syncState === "syncFailed" || trip.syncState === "syncing";
    });
  },
  async recoverInterruptedSyncTrips(userId: string, recoveredAt = new Date().toISOString()) {
    const trips = await this.listStoredTrips(userId);
    let changed = false;
    const nextTrips = trips.map((trip) => {
      if (trip.deletionSyncState === "pendingUndo" && trip.deleteUndoExpiresAt && trip.deleteUndoExpiresAt <= recoveredAt) {
        changed = true;
        return finalizeTripDelete(trip, recoveredAt);
      }

      if (trip.deletionSyncState === "deleting") {
        changed = true;
        return markTripDeleteFailed(trip, "Deletion sync was interrupted before completion. Retry is available.", recoveredAt);
      }

      if (trip.syncState !== "syncing") {
        return trip;
      }

      changed = true;
      return markTripSyncFailed(trip, "Sync was interrupted before completion. Retry is available.", recoveredAt);
    });

    if (changed) {
      await this.saveStoredTrips(userId, nextTrips);
    }

    return visibleTrips(nextTrips);
  },
  async getSnapshot(userId: string): Promise<TripStorageSnapshot> {
    const [activeTrip, storedTrips] = await Promise.all([this.getActiveTrip(userId), this.listStoredTrips(userId)]);
    const recentTrips = visibleTrips(storedTrips);

    return {
      hasActiveTrip: Boolean(activeTrip),
      recentTripsCount: recentTrips.length,
      syncDiagnostics: getTripSyncDiagnostics(storedTrips),
    };
  },
};
