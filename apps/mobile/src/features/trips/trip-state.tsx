import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { StartTripRequest } from "@gigeze/shared";
import { useAuth } from "../auth/auth-context";
import { trackingSampleStore } from "./mobile-tracking/sample-store";
import { mobileTrackingService } from "./mobile-tracking/tracking-service";
import type { TrackingDiagnostics } from "./mobile-tracking/types";
import { deleteCompletedTripFromBackend, fetchBackendTripSummaries, fetchDeletedBackendTrips, syncCompletedTripToBackend } from "./mobile-sync/sync-client";
import { getUserFacingTripError } from "./trip-errors";
import { formatDeletedTripSummary, tripStorage, type PendingUndoDelete, type TripStorageSnapshot } from "./trip-storage";
import {
  completeLocalTripSession,
  createLocalTripSession,
  getTripDiagnostics,
  getTripSyncDiagnostics,
  markTripDeleteFailed,
  markTripDeleteSynced,
  markTripDeleting,
  markTripSynced,
  markTripSyncFailed,
  markTripSyncing,
  type ActiveTripDiagnostics,
  type MobileTripSession,
  type TripMetadataUpdate,
  type TripSyncDiagnostics,
} from "./trip-workflow";

type TripStateStatus = "initializing" | "ready" | "signedOut";

type TripRecoveryResult = {
  tracking: TrackingDiagnostics;
  restoredTrip: MobileTripSession | null;
};

type TripContextValue = {
  status: TripStateStatus;
  activeTrip: MobileTripSession | null;
  recentTrips: MobileTripSession[];
  diagnostics: ActiveTripDiagnostics;
  trackingDiagnostics: TrackingDiagnostics | null;
  nowIso: string;
  error: string | null;
  storageSnapshot: TripStorageSnapshot;
  syncDiagnostics: TripSyncDiagnostics;
  syncInProgress: boolean;
  pendingUndoDelete: PendingUndoDelete | null;
  startTrip: (request?: StartTripRequest) => Promise<MobileTripSession | null>;
  stopTrip: () => Promise<MobileTripSession | null>;
  updateTripMetadata: (tripId: string, metadata: TripMetadataUpdate) => Promise<MobileTripSession[]>;
  deleteTrip: (tripId: string) => Promise<MobileTripSession[]>;
  undoDeleteTrip: () => Promise<MobileTripSession[]>;
  syncPendingTrips: () => Promise<MobileTripSession[]>;
};

const TripContext = createContext<TripContextValue | null>(null);

const initialDiagnostics: ActiveTripDiagnostics = {
  captureMode: "manual",
  sampleCount: 0,
  trackingHealth: "notConfigured",
  syncState: "localOnly",
};

const foregroundSyncIntervalMs = 30000;
const activeTripSampleRefreshIntervalMs = 5000;
const deleteUndoWindowMs = 7000;

function applyTripError(setError: (message: string | null) => void, error: unknown, fallbackMessage: string) {
  const message = getUserFacingTripError(error, fallbackMessage);
  if (message) {
    setError(message);
  }
}

export function TripProvider({ children }: PropsWithChildren) {
  const { session, supabaseSession, status: authStatus } = useAuth();
  const [status, setStatus] = useState<TripStateStatus>("initializing");
  const [activeTrip, setActiveTrip] = useState<MobileTripSession | null>(null);
  const [recentTrips, setRecentTrips] = useState<MobileTripSession[]>([]);
  const [diagnostics, setDiagnostics] = useState<ActiveTripDiagnostics>(initialDiagnostics);
  const [trackingDiagnostics, setTrackingDiagnostics] = useState<TrackingDiagnostics | null>(null);
  const [nowIso, setNowIso] = useState(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [storageSnapshot, setStorageSnapshot] = useState<TripStorageSnapshot>({
    hasActiveTrip: false,
    recentTripsCount: 0,
    syncDiagnostics: getTripSyncDiagnostics([]),
  });
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [pendingUndoDelete, setPendingUndoDelete] = useState<PendingUndoDelete | null>(null);
  const syncInFlightRef = useRef(false);
  const lastForegroundSyncAtRef = useRef(0);
  const undoDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTripRef = useRef<MobileTripSession | null>(null);

  const userId = session?.user.id;
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const activeTripId = activeTrip?.id;

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  const updateRecentTripState = useCallback((trips: MobileTripSession[]) => {
    setRecentTrips(trips);
    setStorageSnapshot((snapshot) => ({
      ...snapshot,
      recentTripsCount: trips.length,
      syncDiagnostics: getTripSyncDiagnostics(trips),
    }));
  }, []);

  const clearUndoDeleteTimer = useCallback(() => {
    if (undoDeleteTimerRef.current) {
      clearTimeout(undoDeleteTimerRef.current);
      undoDeleteTimerRef.current = null;
    }
  }, []);

  const syncPendingTrips = useCallback(async () => {
    if (syncInFlightRef.current) {
      return userId ? tripStorage.listRecentTrips(userId) : [];
    }

    if (!userId) {
      return [];
    }

    if (!accessToken) {
      const trips = userId ? await tripStorage.listRecentTrips(userId) : [];
      const pendingTrips = await tripStorage.listPendingSyncTrips(userId);

      if (pendingTrips.length === 0) {
        updateRecentTripState(trips);
        return trips;
      }

      let latestTrips = trips;
      for (const pendingTrip of pendingTrips) {
        if (pendingTrip.deletedAt) {
          latestTrips = await tripStorage.updateCompletedTrip(
            userId,
            markTripDeleteFailed(pendingTrip, "Signed-in session is not available for trip deletion sync. Sign in again, then retry."),
          );
          continue;
        }

        latestTrips = await tripStorage.updateCompletedTrip(
          userId,
          markTripSyncFailed(pendingTrip, "Signed-in session is not available for trip sync. Sign in again, then retry."),
        );
      }
      updateRecentTripState(latestTrips);
      return latestTrips;
    }

    syncInFlightRef.current = true;
    setSyncInProgress(true);
    setError(null);

    try {
      let latestTrips = await tripStorage.listRecentTrips(userId);
      try {
        latestTrips = await tripStorage.applyRemoteDeletedTrips(userId, await fetchDeletedBackendTrips(accessToken));
      } catch (unknownError) {
        applyTripError(setError, unknownError, "Unable to refresh deleted trips from the backend.");
      }
      try {
        latestTrips = await tripStorage.applyRemoteTripSummaries(userId, await fetchBackendTripSummaries(accessToken));
      } catch (unknownError) {
        applyTripError(setError, unknownError, "Unable to refresh trips from the backend.");
      }
      updateRecentTripState(latestTrips);

      const pendingTrips = await tripStorage.listPendingSyncTrips(userId);

      for (const pendingTrip of pendingTrips) {
        if (pendingTrip.deletedAt) {
          if (!pendingTrip.backendTripId) {
            latestTrips = await tripStorage.updateCompletedTrip(userId, markTripDeleteSynced(pendingTrip));
            updateRecentTripState(latestTrips);
            continue;
          }

          const backendTripId = pendingTrip.backendTripId;
          const deletingTrip = markTripDeleting(pendingTrip);

          latestTrips = await tripStorage.updateCompletedTrip(userId, deletingTrip);
          updateRecentTripState(latestTrips);

          const result = await deleteCompletedTripFromBackend(backendTripId, accessToken);
          const deletedTrip = result.ok ? markTripDeleteSynced(deletingTrip, result.deletedAt) : markTripDeleteFailed(deletingTrip, result.error);

          latestTrips = await tripStorage.updateCompletedTrip(userId, deletedTrip);
          updateRecentTripState(latestTrips);
          continue;
        }

        const syncingTrip = markTripSyncing(pendingTrip);

        latestTrips = await tripStorage.updateCompletedTrip(userId, syncingTrip);
        updateRecentTripState(latestTrips);

        const samples = await trackingSampleStore.listSamples(syncingTrip.id);
        const result = await syncCompletedTripToBackend(syncingTrip, samples, accessToken);
        const syncedTrip = result.ok ? markTripSynced(syncingTrip, result) : markTripSyncFailed(syncingTrip, result.error);
        if (result.ok) {
          await trackingSampleStore.clearSession(syncingTrip.id);
        }

        latestTrips = await tripStorage.updateCompletedTrip(userId, syncedTrip);
        updateRecentTripState(latestTrips);
      }

      return latestTrips;
    } finally {
      syncInFlightRef.current = false;
      setSyncInProgress(false);
    }
  }, [accessToken, updateRecentTripState, userId]);

  const finalizePendingUndoDelete = useCallback(async (tripId: string) => {
    if (!userId) {
      return [];
    }

    const latestTrips = await tripStorage.finalizeCompletedTripDelete(userId, tripId);
    setPendingUndoDelete((current) => (current?.tripId === tripId ? null : current));
    updateRecentTripState(latestTrips);
    void syncPendingTrips().catch((unknownError: unknown) => {
      applyTripError(setError, unknownError, "Unable to sync deleted trip.");
    });
    return latestTrips;
  }, [syncPendingTrips, updateRecentTripState, userId]);

  const scheduleUndoDeleteFinalization = useCallback((pendingDelete: PendingUndoDelete) => {
    clearUndoDeleteTimer();
    const remainingMs = Math.max(0, new Date(pendingDelete.undoExpiresAt).getTime() - Date.now());

    undoDeleteTimerRef.current = setTimeout(() => {
      void finalizePendingUndoDelete(pendingDelete.tripId).catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to finalize deleted trip.");
      });
    }, remainingMs);
  }, [clearUndoDeleteTimer, finalizePendingUndoDelete]);

  useEffect(() => {
    let isMounted = true;

    if (authStatus === "loading") {
      setStatus("initializing");
      return () => {
        isMounted = false;
      };
    }

    if (!userId) {
      setActiveTrip(null);
      setRecentTrips([]);
      setDiagnostics(initialDiagnostics);
      setTrackingDiagnostics(null);
      clearUndoDeleteTimer();
      setPendingUndoDelete(null);
      setStorageSnapshot({ hasActiveTrip: false, recentTripsCount: 0, syncDiagnostics: getTripSyncDiagnostics([]) });
      setStatus("signedOut");
      return () => {
        isMounted = false;
      };
    }

    setStatus("initializing");
    setError(null);
    const restoreUserId = userId;

    async function restoreTrips() {
      await tripStorage.recoverInterruptedSyncTrips(restoreUserId);
      const [storedActiveTrip, storedRecentTrips, snapshot] = await Promise.all([
        tripStorage.getActiveTrip(restoreUserId),
        tripStorage.listRecentTrips(restoreUserId),
        tripStorage.getSnapshot(restoreUserId),
      ]);
      const pendingDelete = await tripStorage.getPendingUndoDelete(restoreUserId);

      if (!isMounted) {
        return undefined;
      }

      setActiveTrip(storedActiveTrip);
      setRecentTrips(storedRecentTrips);
      setDiagnostics(getTripDiagnostics(storedActiveTrip));
      setStorageSnapshot(snapshot);
      setPendingUndoDelete(pendingDelete);
      if (pendingDelete) {
        scheduleUndoDeleteFinalization(pendingDelete);
      }
      setStatus("ready");
      void syncPendingTrips().catch((unknownError: unknown) => {
        if (isMounted) {
          applyTripError(setError, unknownError, "Unable to sync completed trips.");
        }
      });

      if (!storedActiveTrip) {
        return {
          tracking: await mobileTrackingService.recoverTracking(null),
          restoredTrip: null,
        };
      }

      await mobileTrackingService.recoverTracking(storedActiveTrip);
      const drain = await mobileTrackingService.drainSamples(storedActiveTrip);
      const restoredTrip: MobileTripSession = {
        ...storedActiveTrip,
        sampleCount: drain.importedSampleCount,
        lastSampleAt: drain.lastSampleAt,
        lastDrainAt: drain.diagnostics.lastDrainAt,
        lastImportAt: drain.lastImportAt,
        lastImportCount: drain.importedCount,
        updatedAt: new Date().toISOString(),
      };

      await tripStorage.saveActiveTrip(restoreUserId, restoredTrip);

      return {
        tracking: drain.diagnostics,
        restoredTrip,
      };
    }

    restoreTrips()
      .then((recovery: TripRecoveryResult | undefined) => {
        if (!isMounted) {
          return;
        }
        if (!recovery) {
          return;
        }
        if (recovery.restoredTrip) {
          setActiveTrip(recovery.restoredTrip);
          setDiagnostics(getTripDiagnostics(recovery.restoredTrip));
        }
        setTrackingDiagnostics(recovery.tracking);
      })
      .catch((unknownError: unknown) => {
        if (!isMounted) {
          return;
        }

        applyTripError(setError, unknownError, "Unable to load local trips.");
        setActiveTrip(null);
        setRecentTrips([]);
        setDiagnostics(initialDiagnostics);
        setTrackingDiagnostics(null);
        setStatus("ready");
      });

    return () => {
      isMounted = false;
    };
  }, [authStatus, clearUndoDeleteTimer, scheduleUndoDeleteFinalization, syncPendingTrips, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }

      const now = Date.now();
      if (now - lastForegroundSyncAtRef.current < foregroundSyncIntervalMs) {
        return;
      }

      lastForegroundSyncAtRef.current = now;
      void syncPendingTrips().catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to sync completed trips.");
      });
    });

    return () => {
      subscription.remove();
    };
  }, [syncPendingTrips]);

  useEffect(() => {
    if (!activeTripId || !userId) {
      return undefined;
    }

    const refreshTripId = activeTripId;
    const refreshUserId = userId;
    let cancelled = false;

    async function refreshActiveTripSamples() {
      setNowIso(new Date().toISOString());
      try {
        const refreshTrip = activeTripRef.current;
        if (!refreshTrip || refreshTrip.id !== refreshTripId) {
          return;
        }

        const drain = await mobileTrackingService.drainSamples(refreshTrip);
        if (cancelled) {
          return;
        }

        const refreshedTrip: MobileTripSession = {
          ...refreshTrip,
          sampleCount: drain.importedSampleCount,
          lastSampleAt: drain.lastSampleAt,
          lastDrainAt: drain.diagnostics.lastDrainAt,
          lastImportAt: drain.lastImportAt,
          lastImportCount: drain.importedCount,
          updatedAt: new Date().toISOString(),
        };
        setActiveTrip(refreshedTrip);
        setDiagnostics(getTripDiagnostics(refreshedTrip));
        setTrackingDiagnostics(drain.diagnostics);
        await tripStorage.saveActiveTrip(refreshUserId, refreshedTrip);
      } catch (unknownError) {
        if (!cancelled) {
          applyTripError(setError, unknownError, "Unable to refresh tracking samples.");
        }
      }
    }

    const intervalId = setInterval(() => {
      void refreshActiveTripSamples();
    }, activeTripSampleRefreshIntervalMs);

    setNowIso(new Date().toISOString());
    void refreshActiveTripSamples();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeTripId, userId]);

  const startTrip = useCallback((request: StartTripRequest = {}) => {
    if (!userId) {
      return Promise.resolve(null);
    }

    const response = createLocalTripSession(request, session);
    const nextTrip: MobileTripSession = {
      ...response.session,
      captureMode: "tracking",
    };
    setActiveTrip(nextTrip);
    setDiagnostics(getTripDiagnostics(nextTrip));
    setStorageSnapshot((snapshot) => ({
      ...snapshot,
      hasActiveTrip: true,
    }));

    return tripStorage
      .saveActiveTrip(userId, nextTrip)
      .then(() => mobileTrackingService.startTracking(nextTrip))
      .then((tracking) => {
        setTrackingDiagnostics(tracking);
        return nextTrip;
      })
      .then(() => nextTrip)
      .catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to save active trip.");
        throw unknownError;
      });
  }, [session, userId]);

  const stopTrip = useCallback(() => {
    if (!userId || !activeTrip) {
      return Promise.resolve(null);
    }

    const tripToComplete = activeTrip;
    setTrackingDiagnostics((currentDiagnostics) =>
      currentDiagnostics
        ? {
          ...currentDiagnostics,
          operationState: "stopping",
          updatedAt: new Date().toISOString(),
        }
        : currentDiagnostics,
    );

    return mobileTrackingService
      .stopTracking(tripToComplete)
      .then((tracking) => {
        setTrackingDiagnostics(tracking.diagnostics);
        if (!tracking.diagnostics.stopVerified) {
          throw new Error(
            tracking.diagnostics.lastError ??
              "Tracking Gig could not be verified. The trip is still stored locally; try stopping again before completing it.",
          );
        }
        const completedTrip = completeLocalTripSession({
          ...tripToComplete,
          sampleCount: tracking.importedSampleCount,
          lastSampleAt: tracking.lastSampleAt,
          lastDrainAt: tracking.diagnostics.lastDrainAt,
          lastImportAt: tracking.lastImportAt,
          lastImportCount: tracking.importedCount,
          updatedAt: new Date().toISOString(),
        });
        return tripStorage.clearActiveTrip(userId).then(() => tripStorage.saveCompletedTrip(userId, completedTrip));
      })
      .then((storedTrips) => {
        setActiveTrip(null);
        setDiagnostics(initialDiagnostics);
        updateRecentTripState(storedTrips);
        setStorageSnapshot((snapshot) => ({
          ...snapshot,
          hasActiveTrip: false,
        }));
        void syncPendingTrips().catch((unknownError: unknown) => {
          applyTripError(setError, unknownError, "Unable to sync completed trips.");
        });
        return storedTrips[0] ?? null;
      })
      .catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to complete trip.");
        throw unknownError;
      });
  }, [activeTrip, syncPendingTrips, updateRecentTripState, userId]);

  const deleteTrip = useCallback((tripId: string) => {
    if (!userId) {
      return Promise.resolve([]);
    }

    const deletedAt = new Date().toISOString();
    const undoExpiresAt = new Date(Date.now() + deleteUndoWindowMs).toISOString();

    const finalizeExistingUndo = pendingUndoDelete
      ? tripStorage.finalizeCompletedTripDelete(userId, pendingUndoDelete.tripId)
      : Promise.resolve<MobileTripSession[]>([]);

    return finalizeExistingUndo
      .then(() => tripStorage.stageCompletedTripDelete(userId, tripId, undoExpiresAt, deletedAt))
      .then((storedTrips) => {
        const nextPendingDelete = recentTrips.find((trip) => trip.id === tripId);
        const undoDelete = {
          tripId,
          title: nextPendingDelete?.title ?? "Trip",
          message: nextPendingDelete ? formatDeletedTripSummary(nextPendingDelete) : "Trip deleted",
          undoExpiresAt,
        };
        setPendingUndoDelete(undoDelete);
        scheduleUndoDeleteFinalization(undoDelete);
        updateRecentTripState(storedTrips);
        if (pendingUndoDelete) {
          void syncPendingTrips().catch((unknownError: unknown) => {
            applyTripError(setError, unknownError, "Unable to sync deleted trip.");
          });
        }
        return storedTrips;
      })
      .catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to delete trip.");
        throw unknownError;
      });
  }, [pendingUndoDelete, recentTrips, scheduleUndoDeleteFinalization, syncPendingTrips, updateRecentTripState, userId]);

  const updateCompletedTripMetadata = useCallback((tripId: string, metadata: TripMetadataUpdate) => {
    if (!userId) {
      return Promise.resolve([]);
    }

    return tripStorage
      .updateCompletedTripMetadata(userId, tripId, metadata)
      .then((storedTrips) => {
        updateRecentTripState(storedTrips);
        void syncPendingTrips().catch((unknownError: unknown) => {
          applyTripError(setError, unknownError, "Unable to sync edited trip.");
        });
        return storedTrips;
      })
      .catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to update trip.");
        throw unknownError;
      });
  }, [syncPendingTrips, updateRecentTripState, userId]);

  const undoDeleteTrip = useCallback(() => {
    if (!userId || !pendingUndoDelete) {
      return Promise.resolve(recentTrips);
    }

    const tripId = pendingUndoDelete.tripId;
    clearUndoDeleteTimer();
    setPendingUndoDelete(null);

    return tripStorage
      .undoCompletedTripDelete(userId, tripId)
      .then((storedTrips) => {
        updateRecentTripState(storedTrips);
        return storedTrips;
      })
      .catch((unknownError: unknown) => {
        applyTripError(setError, unknownError, "Unable to undo trip deletion.");
        throw unknownError;
      });
  }, [clearUndoDeleteTimer, pendingUndoDelete, recentTrips, updateRecentTripState, userId]);

  useEffect(() => clearUndoDeleteTimer, [clearUndoDeleteTimer]);

  const value = useMemo<TripContextValue>(
    () => ({
      status,
      activeTrip,
      recentTrips,
      diagnostics,
      trackingDiagnostics,
      nowIso,
      error,
      storageSnapshot,
      syncDiagnostics: storageSnapshot.syncDiagnostics,
      syncInProgress,
      pendingUndoDelete,
      startTrip,
      stopTrip,
      updateTripMetadata: updateCompletedTripMetadata,
      deleteTrip,
      undoDeleteTrip,
      syncPendingTrips,
    }),
    [activeTrip, deleteTrip, diagnostics, error, nowIso, pendingUndoDelete, recentTrips, startTrip, status, stopTrip, storageSnapshot, syncInProgress, syncPendingTrips, trackingDiagnostics, undoDeleteTrip, updateCompletedTripMetadata],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTripState() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTripState must be used inside TripProvider");
  }
  return context;
}
