import type { AuthSession, StartTripRequest, StartTripResponse, TripSession } from "@gigeze/shared";
import { isValidDistanceKm } from "./trip-distance";

export type TripCaptureMode = "manual" | "tracking";

export type TrackingHealth = "notConfigured" | "ready" | "degraded";

export type TripSyncState = "localOnly" | "pendingSync" | "syncing" | "synced" | "syncFailed";
export type TripDeletionSyncState = "notDeleted" | "pendingUndo" | "pendingDelete" | "deleting" | "deleted" | "deleteFailed";

export type MobileTripSession = TripSession & {
  title: string;
  sampleCount: number;
  lastSampleAt?: string;
  lastDrainAt?: string;
  lastImportAt?: string;
  lastImportCount?: number;
  captureMode: TripCaptureMode;
  syncState: TripSyncState;
  lastSyncAttemptAt?: string;
  lastSyncSucceededAt?: string;
  lastSyncError?: string;
  backendTripId?: string;
  backendEditHref?: string;
  backendDistanceKm?: number;
  startLocation?: string;
  endLocation?: string;
  purpose?: string;
  deletedAt?: string;
  deletionSyncState?: TripDeletionSyncState;
  deletionSyncAttemptAt?: string;
  deletionSyncError?: string;
  deleteUndoExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompleteTripSyncMetadata = {
  backendTripId?: string;
  backendEditHref?: string;
  backendDistanceKm?: number;
  deletedAt?: string;
};

export type TripMetadataUpdate = {
  tripMode?: MobileTripSession["tripMode"];
  tripPurpose?: MobileTripSession["tripPurpose"];
  purpose?: string;
  vehicleId?: string;
  vehicleName?: string;
  startOdometer?: number;
  endOdometer?: number;
};

export type ActiveTripDiagnostics = {
  captureMode: TripCaptureMode;
  sampleCount: number;
  lastSampleAt?: string;
  trackingHealth: TrackingHealth;
  syncState: TripSyncState;
};

export type TripSyncDiagnostics = {
  pendingSyncCount: number;
  syncingCount: number;
  syncedCount: number;
  syncFailedCount: number;
  localOnlyCount: number;
  pendingDeleteCount: number;
  lastSyncAttemptAt?: string;
  lastSyncSucceededAt?: string;
  lastSyncError?: string;
};

export type StartLocalTripResponse = StartTripResponse & {
  session: MobileTripSession;
};

function normalizeTripPurposeForSession(
  tripMode: StartTripRequest["tripMode"] | MobileTripSession["tripMode"] | undefined,
  vehicleId: string | undefined,
  tripPurpose: StartTripRequest["tripPurpose"] | MobileTripSession["tripPurpose"] | undefined,
) {
  if (tripMode === "WALK" || !vehicleId) {
    return undefined;
  }

  return tripPurpose;
}

export function createLocalTripSession(request: StartTripRequest, session: AuthSession | null): StartLocalTripResponse {
  const startedAt = request.startedAt ?? new Date().toISOString();
  const tripMode = request.tripMode ?? "DRIVE";
  const vehicleId = tripMode === "WALK" ? undefined : request.vehicleId;

  return {
    session: {
      id: `local-${Date.now()}`,
      userId: session?.user.id ?? "anonymous-local-user",
      journeyId: request.journeyId,
      journeyTitle: request.journeyTitle,
      tripMode,
      vehicleId,
      vehicleName: request.vehicleName,
      tripPurpose: normalizeTripPurposeForSession(tripMode, vehicleId, request.tripPurpose),
      startOdometer: tripMode === "WALK" ? undefined : request.startOdometer,
      endOdometer: tripMode === "WALK" ? undefined : request.endOdometer,
      status: "active",
      startedAt,
      distanceMeters: 0,
      title: `Trip ${new Date(startedAt).toLocaleDateString()}`,
      sampleCount: 0,
      captureMode: "manual",
      syncState: "localOnly",
      createdAt: startedAt,
      updatedAt: startedAt,
    },
  };
}

export function completeLocalTripSession(session: MobileTripSession, endedAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    status: "completed",
    endedAt,
    syncState: "pendingSync",
    updatedAt: endedAt,
  };
}

export function markTripSyncing(session: MobileTripSession, attemptedAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    syncState: "syncing",
    lastSyncAttemptAt: attemptedAt,
    lastSyncError: undefined,
    updatedAt: attemptedAt,
  };
}

export function markTripSyncFailed(session: MobileTripSession, error: string, failedAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    syncState: "syncFailed",
    lastSyncAttemptAt: session.lastSyncAttemptAt ?? failedAt,
    lastSyncError: error,
    updatedAt: failedAt,
  };
}

export function markTripSynced(
  session: MobileTripSession,
  metadata: CompleteTripSyncMetadata,
  syncedAt = new Date().toISOString(),
): MobileTripSession {
  if (metadata.deletedAt || session.deletedAt) {
    return markTripDeleteSynced(session, metadata.deletedAt ?? session.deletedAt ?? syncedAt);
  }

  return {
    ...session,
    syncState: "synced",
    lastSyncSucceededAt: syncedAt,
    lastSyncError: undefined,
    backendTripId: metadata.backendTripId ?? session.backendTripId,
    backendEditHref: metadata.backendEditHref ?? session.backendEditHref,
    backendDistanceKm: isValidDistanceKm(metadata.backendDistanceKm) ? metadata.backendDistanceKm : session.backendDistanceKm,
    updatedAt: syncedAt,
  };
}

export function updateTripMetadata(
  session: MobileTripSession,
  metadata: TripMetadataUpdate,
  updatedAt = new Date().toISOString(),
): MobileTripSession {
  if (session.deletedAt) {
    return session;
  }

  return {
    ...session,
    tripMode: metadata.tripMode ?? session.tripMode,
    tripPurpose: normalizeTripPurposeForSession(
      metadata.tripMode ?? session.tripMode,
      "vehicleId" in metadata ? metadata.vehicleId : session.vehicleId,
      "tripPurpose" in metadata ? metadata.tripPurpose : session.tripPurpose,
    ),
    purpose: "purpose" in metadata ? metadata.purpose : session.purpose,
    vehicleId: "vehicleId" in metadata ? metadata.vehicleId : session.vehicleId,
    vehicleName: "vehicleName" in metadata ? metadata.vehicleName : session.vehicleName,
    startOdometer: "startOdometer" in metadata ? metadata.startOdometer : session.startOdometer,
    endOdometer: "endOdometer" in metadata ? metadata.endOdometer : session.endOdometer,
    syncState: session.status === "completed" ? "pendingSync" : session.syncState,
    lastSyncError: undefined,
    updatedAt,
  };
}

export function getTripDiagnostics(session: MobileTripSession | null): ActiveTripDiagnostics {
  return {
    captureMode: session?.captureMode ?? "manual",
    sampleCount: session?.sampleCount ?? 0,
    lastSampleAt: session?.lastSampleAt,
    trackingHealth: session ? "ready" : "notConfigured",
    syncState: session?.syncState ?? "localOnly",
  };
}

export function getTripSyncDiagnostics(trips: MobileTripSession[]): TripSyncDiagnostics {
  const diagnostics: TripSyncDiagnostics = {
    pendingSyncCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    syncFailedCount: 0,
    localOnlyCount: 0,
    pendingDeleteCount: 0,
  };

  for (const trip of trips) {
    if (trip.deletedAt) {
      if (
        trip.deletionSyncState === "pendingDelete" ||
        trip.deletionSyncState === "deleting" ||
        trip.deletionSyncState === "deleteFailed"
      ) {
        diagnostics.pendingDeleteCount += 1;
      }
      continue;
    }

    if (trip.syncState === "pendingSync") {
      diagnostics.pendingSyncCount += 1;
    } else if (trip.syncState === "syncing") {
      diagnostics.syncingCount += 1;
    } else if (trip.syncState === "synced") {
      diagnostics.syncedCount += 1;
    } else if (trip.syncState === "syncFailed") {
      diagnostics.syncFailedCount += 1;
    } else {
      diagnostics.localOnlyCount += 1;
    }

    const hadLatestAttempt = Boolean(
      trip.lastSyncAttemptAt && (!diagnostics.lastSyncAttemptAt || trip.lastSyncAttemptAt > diagnostics.lastSyncAttemptAt),
    );

    if (hadLatestAttempt) {
      diagnostics.lastSyncAttemptAt = trip.lastSyncAttemptAt;
      diagnostics.lastSyncError = trip.lastSyncError;
    }

    if (trip.lastSyncSucceededAt && (!diagnostics.lastSyncSucceededAt || trip.lastSyncSucceededAt > diagnostics.lastSyncSucceededAt)) {
      diagnostics.lastSyncSucceededAt = trip.lastSyncSucceededAt;
    }
  }

  return diagnostics;
}

export function markTripDeleted(session: MobileTripSession, deletedAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    deletedAt,
    deletionSyncState: session.backendTripId ? "pendingDelete" : "deleted",
    deletionSyncError: undefined,
    updatedAt: deletedAt,
  };
}

export function stageTripDelete(
  session: MobileTripSession,
  undoExpiresAt: string,
  deletedAt = new Date().toISOString(),
): MobileTripSession {
  return {
    ...session,
    deletedAt,
    deletionSyncState: "pendingUndo",
    deletionSyncAttemptAt: undefined,
    deletionSyncError: undefined,
    deleteUndoExpiresAt: undoExpiresAt,
    updatedAt: deletedAt,
  };
}

export function undoTripDelete(session: MobileTripSession, restoredAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    deletedAt: undefined,
    deletionSyncState: "notDeleted",
    deletionSyncAttemptAt: undefined,
    deletionSyncError: undefined,
    deleteUndoExpiresAt: undefined,
    updatedAt: restoredAt,
  };
}

export function finalizeTripDelete(session: MobileTripSession, finalizedAt = new Date().toISOString()): MobileTripSession {
  if (!session.deletedAt) {
    return session;
  }

  return {
    ...session,
    deletionSyncState: session.backendTripId ? "pendingDelete" : "deleted",
    deletionSyncError: undefined,
    deleteUndoExpiresAt: undefined,
    updatedAt: finalizedAt,
  };
}

export function markTripDeleting(session: MobileTripSession, attemptedAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    deletionSyncState: "deleting",
    deletionSyncAttemptAt: attemptedAt,
    deletionSyncError: undefined,
    updatedAt: attemptedAt,
  };
}

export function markTripDeleteFailed(session: MobileTripSession, error: string, failedAt = new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    deletionSyncState: "deleteFailed",
    deletionSyncAttemptAt: session.deletionSyncAttemptAt ?? failedAt,
    deletionSyncError: error,
    updatedAt: failedAt,
  };
}

export function markTripDeleteSynced(session: MobileTripSession, deletedAt = session.deletedAt ?? new Date().toISOString()): MobileTripSession {
  return {
    ...session,
    deletedAt,
    deletionSyncState: "deleted",
    deletionSyncError: undefined,
    updatedAt: deletedAt,
  };
}
