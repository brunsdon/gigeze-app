"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateMobileDiagnostics } from "@/features/mobile/diagnostics";
import { getAppLifecycleProvider } from "@/features/mobile/lifecycle-provider";
import { getAppPersistenceProvider } from "@/features/mobile/persistence";
import { getTripTrackingProvider, type TripTrackingSessionStatus } from "@/features/mobile/tracking-provider";
import {
  appendTripSample,
  buildRoutePolyline,
  detectStopSuggestions,
  type TripSample,
} from "@/features/trips/tracking";
import {
  clearTripSession,
  readTripSession,
  TRIP_SESSION_EVENT,
  type TripSessionState,
  writeTripSession,
} from "@/features/trips/session-store";

type StartTripOptions = {
  journeyId?: string;
  journeySlug?: string;
  journeyTitle?: string;
};

export type CompletedTripSummary = {
  journeyId?: string;
  journeySlug?: string;
  journeyTitle?: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  elapsedMs: number;
  sampleCount: number;
  samples: TripSample[];
  hadTrackingGaps: boolean;
  routePolyline: Array<{ latitude: number; longitude: number }>;
  stopSuggestions: ReturnType<typeof detectStopSuggestions>;
};

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
};

const MINIMUM_GAP_THRESHOLD_MS = 45_000;
const NATIVE_BACKGROUND_DRAIN_INTERVAL_MS = 60_000;

function getWakeLockPreferenceKey(workspaceId: string) {
  return `gigeze.trip-wake-lock.v1:${workspaceId}`;
}

function readWakeLockPreference(workspaceId: string) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return true;
  }

  const stored = persistence.getItem(getWakeLockPreferenceKey(workspaceId));
  if (stored === null) {
    return true;
  }

  return stored === "1";
}

function writeWakeLockPreference(workspaceId: string, enabled: boolean) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return;
  }

  persistence.setItem(getWakeLockPreferenceKey(workspaceId), enabled ? "1" : "0");
}

function getSamplingGapThresholdMs(gpsSamplingIntervalSeconds: number) {
  return Math.max(gpsSamplingIntervalSeconds * 3_000, MINIMUM_GAP_THRESHOLD_MS);
}

function nowIso() {
  return new Date().toISOString();
}

export function useTripTracker(workspaceId: string, gpsSamplingIntervalSeconds: number = 15) {
  const lifecycleProvider = useMemo(() => getAppLifecycleProvider(), []);
  const persistenceProvider = useMemo(() => getAppPersistenceProvider(), []);
  const trackingProvider = useMemo(() => getTripTrackingProvider(), []);
  const [session, setSession] = useState<TripSessionState | null>(() => readTripSession(workspaceId));
  const [lastError, setLastError] = useState<string | null>(null);
  const [wakeLockEnabled, setWakeLockEnabledState] = useState(() => readWakeLockPreference(workspaceId));
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);

  const sessionRef = useRef<TripSessionState | null>(session);
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wakeLockReleaseListenerRef = useRef<(() => void) | null>(null);
  const isReconcilingProviderSamplesRef = useRef(false);

  const geolocationSupported = trackingProvider.isGeolocationSupported();
  const wakeLockSupported = trackingProvider.isWakeLockSupported();
  const trackingBackgroundReadiness = trackingProvider.getBackgroundReadiness();
  const samplingGapThresholdMs = getSamplingGapThresholdMs(gpsSamplingIntervalSeconds);
  const [trackingPermissionState, setTrackingPermissionState] = useState<Awaited<ReturnType<typeof trackingProvider.getPermissionState>>>("unknown");
  const [trackingAvailability, setTrackingAvailability] = useState<Awaited<ReturnType<typeof trackingProvider.getAvailability>>>({
    status: geolocationSupported ? "available" : "unavailable",
    reason: geolocationSupported ? undefined : "unsupported",
  });
  const [trackingRecoveryState, setTrackingRecoveryState] = useState<Awaited<ReturnType<typeof trackingProvider.recoverActiveSession>>>({
    status: "none",
  });
  const [trackingSessionStatus, setTrackingSessionStatus] = useState<TripTrackingSessionStatus>({
    state: session ? "active" : "idle",
    session: session
      ? {
          sessionId: session.id,
          workspaceId: session.workspaceId,
          journeyId: session.journeyId,
          journeySlug: session.journeySlug,
          journeyTitle: session.journeyTitle,
          startedAt: session.startedAt,
          samplingIntervalSeconds: gpsSamplingIntervalSeconds,
          mode: trackingProvider.getTrackingMode(),
          continuityMode: trackingBackgroundReadiness.continuityMode,
          lifecycleOwner: trackingBackgroundReadiness.lifecycleOwner,
        }
      : null,
  });

  sessionRef.current = session;

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockSentinelRef.current;
    if (!sentinel) {
      setWakeLockActive(false);
      return;
    }

    const releaseListener = wakeLockReleaseListenerRef.current;
    if (releaseListener && sentinel.removeEventListener) {
      sentinel.removeEventListener("release", releaseListener);
    }

    wakeLockSentinelRef.current = null;
    wakeLockReleaseListenerRef.current = null;

    try {
      if (!sentinel.released) {
        await sentinel.release();
      }
    } catch {
      // Ignore release failures and simply clear the local state.
    }

    setWakeLockActive(false);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (
      !wakeLockSupported
      || !sessionRef.current
      || !wakeLockEnabled
      || lifecycleProvider.getSnapshot().visibility === "background"
    ) {
      return false;
    }

    if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
      setWakeLockActive(true);
      setWakeLockError(null);
      return true;
    }

    try {
      const sentinel = await trackingProvider.requestScreenWakeLock();
      if (!sentinel) {
        setWakeLockActive(false);
        return false;
      }

      const onRelease = () => {
        wakeLockSentinelRef.current = null;
        wakeLockReleaseListenerRef.current = null;
        setWakeLockActive(false);
      };

      sentinel.addEventListener?.("release", onRelease);
      wakeLockSentinelRef.current = sentinel;
      wakeLockReleaseListenerRef.current = onRelease;
      setWakeLockActive(true);
      setWakeLockError(null);
      return true;
    } catch {
      setWakeLockActive(false);
      setWakeLockError("wake-lock-rejected");
      return false;
    }
  }, [lifecycleProvider, trackingProvider, wakeLockEnabled, wakeLockSupported]);

  const persistSession = useCallback((nextSession: TripSessionState | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);

    if (nextSession) {
      writeTripSession(workspaceId, nextSession);
      return;
    }

    clearTripSession(workspaceId);
  }, [workspaceId]);

  const syncFromStorage = useCallback(() => {
    const nextSession = readTripSession(workspaceId);
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, [workspaceId]);

  const reconcileProviderSampleStore = useCallback(async () => {
    if (isReconcilingProviderSamplesRef.current) {
      return 0;
    }

    const currentSession = sessionRef.current;
    if (!currentSession) {
      return 0;
    }

    isReconcilingProviderSamplesRef.current = true;
    const sampleStore = trackingProvider.getSampleStore();
    try {
      const providerSamples = await sampleStore.listSamples(currentSession.id);
      if (providerSamples.length === 0) {
        return 0;
      }

      let nextSession = currentSession;
      for (const providerSample of providerSamples) {
        const alreadyImported = nextSession.samples.some((sample) =>
          sample.recordedAt === providerSample.recordedAt
          && sample.latitude === providerSample.latitude
          && sample.longitude === providerSample.longitude,
        );
        if (alreadyImported) {
          continue;
        }

        const sample: TripSample = {
          latitude: providerSample.latitude,
          longitude: providerSample.longitude,
          accuracyMeters: providerSample.accuracyMeters,
          recordedAt: providerSample.recordedAt,
        };
        const appended = appendTripSample(nextSession.samples, sample);
        nextSession = {
          ...nextSession,
          lastSampleAt: sample.recordedAt,
          samples: appended.samples,
          totalDistanceKm: nextSession.totalDistanceKm + appended.distanceIncrementKm,
          geolocationDenied: false,
          geolocationUnavailable: false,
        };
      }

      await sampleStore.clearSession(currentSession.id);
      persistSession(nextSession);
      return providerSamples.length;
    } finally {
      isReconcilingProviderSamplesRef.current = false;
    }
  }, [persistSession, trackingProvider]);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    let cancelled = false;

    void trackingProvider.getPermissionState().then((permissionState) => {
      if (!cancelled) {
        setTrackingPermissionState(permissionState);
        updateMobileDiagnostics({ trackingPermissionState: permissionState });
      }
    });

    void trackingProvider.getAvailability().then((availability) => {
      if (!cancelled) {
        setTrackingAvailability(availability);
        updateMobileDiagnostics({ trackingAvailability: availability });
      }
    });

    void trackingProvider.getTrackingSessionStatus().then((status) => {
      if (!cancelled) {
        setTrackingSessionStatus(status);
      }
    });

    void trackingProvider.recoverActiveSession().then((recoveryState) => {
      if (!cancelled) {
        setTrackingRecoveryState(recoveryState);
        if (recoveryState.sessionStatus) {
          setTrackingSessionStatus(recoveryState.sessionStatus);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [trackingProvider]);

  useEffect(() => {
    updateMobileDiagnostics({
      trackingSamplingPath:
        trackingProvider.kind === "browser"
          ? "browser"
          : "fallback",
      trackingBackgroundReadiness: trackingProvider.getBackgroundReadiness(),
    });
  }, [trackingProvider]);

  useEffect(() => {
    setWakeLockEnabledState(readWakeLockPreference(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (trackingSessionStatus.state === "active" && trackingSessionStatus.session?.sessionId === session.id) {
      return;
    }

    void trackingProvider.startTrackingSession({
      sessionId: session.id,
      workspaceId: session.workspaceId,
      journeyId: session.journeyId,
      journeySlug: session.journeySlug,
      journeyTitle: session.journeyTitle,
      startedAt: session.startedAt,
      samplingIntervalSeconds: gpsSamplingIntervalSeconds,
    }).then((status) => {
      setTrackingSessionStatus(status);
    });
  }, [gpsSamplingIntervalSeconds, session, trackingProvider, trackingSessionStatus.session?.sessionId, trackingSessionStatus.state]);

  useEffect(() => {
    const onStorage = (event: { key: string | null }) => {
      if (event.key && !event.key.endsWith(`:${workspaceId}`)) {
        return;
      }

      syncFromStorage();
    };

    const onTripEvent = () => syncFromStorage();
    const removeStorageListener = persistenceProvider.subscribeStorageChanges(onStorage);
    const removeTripEventListener = persistenceProvider.subscribe(TRIP_SESSION_EVENT, onTripEvent);

    return () => {
      removeStorageListener();
      removeTripEventListener();
    };
  }, [persistenceProvider, syncFromStorage, workspaceId]);

  useEffect(() => () => {
    void releaseWakeLock();
  }, [releaseWakeLock]);

  const captureSample = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (!geolocationSupported || !currentSession) {
      return false;
    }

    const result = await trackingProvider.sampleCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 10_000,
    });

    if (!result.position) {
      setLastError(result.errorCode === "permission-denied" ? "location-permission-denied" : "location-unavailable");

      if (result.errorCode === "permission-denied") {
        const updated = { ...currentSession, geolocationDenied: true };
        persistSession(updated);
      }

      return false;
    }

    const sample: TripSample = {
      latitude: result.position.latitude,
      longitude: result.position.longitude,
      accuracyMeters: result.position.accuracyMeters,
      recordedAt: nowIso(),
    };

    const refreshedSession = sessionRef.current ?? currentSession;
    const appended = appendTripSample(refreshedSession.samples, sample);
    const updated: TripSessionState = {
      ...refreshedSession,
      lastSampleAt: sample.recordedAt,
      samples: appended.samples,
      totalDistanceKm: refreshedSession.totalDistanceKm + appended.distanceIncrementKm,
      geolocationDenied: false,
      geolocationUnavailable: false,
    };

    persistSession(updated);
    return true;
  }, [geolocationSupported, persistSession, trackingProvider]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const samplingIntervalMs = gpsSamplingIntervalSeconds * 1000;
    const timer = window.setInterval(() => {
      void captureSample();
    }, samplingIntervalMs);

    return () => window.clearInterval(timer);
  }, [captureSample, session, gpsSamplingIntervalSeconds]);

  useEffect(() => {
    if (!session || trackingProvider.getBackgroundReadiness().lifecycleOwner !== "native-service") {
      return;
    }

    const timer = window.setInterval(() => {
      void trackingProvider.getTrackingSessionStatus().then((status) => {
        setTrackingSessionStatus(status);
        void reconcileProviderSampleStore();
      });
    }, NATIVE_BACKGROUND_DRAIN_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [reconcileProviderSampleStore, session, trackingProvider]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const unsubscribe = lifecycleProvider.subscribe((event) => {
      const currentSession = sessionRef.current;
      if (!currentSession) {
        return;
      }

      if (event.type === "background") {
        if (!currentSession.hiddenAt) {
          persistSession({
            ...currentSession,
            hiddenAt: nowIso(),
          });
        }

        void releaseWakeLock();
        return;
      }

      if (event.type !== "resumed") {
        return;
      }

      const resumedAt = nowIso();
      const backgroundDurationMs = currentSession.hiddenAt
        ? Math.max(0, new Date(resumedAt).getTime() - new Date(currentSession.hiddenAt).getTime())
        : null;
      const timeSinceLastSampleMs = Math.max(0, new Date(resumedAt).getTime() - new Date(currentSession.lastSampleAt).getTime());
      const hadTrackingGap = Boolean(
        currentSession.hadTrackingGap
        || (backgroundDurationMs !== null && backgroundDurationMs >= samplingGapThresholdMs)
        || timeSinceLastSampleMs >= samplingGapThresholdMs,
      );

      persistSession({
        ...currentSession,
        hiddenAt: null,
        hadTrackingGap,
        lastBackgroundDurationMs: backgroundDurationMs,
        lastVisibilityResumeAt: resumedAt,
      });

      if (wakeLockEnabled) {
        void requestWakeLock();
      }

      void trackingProvider.getTrackingSessionStatus().then((status) => {
        setTrackingSessionStatus(status);
        void reconcileProviderSampleStore();
      });
    });

    return () => {
      unsubscribe();
    };
  }, [lifecycleProvider, persistSession, reconcileProviderSampleStore, releaseWakeLock, requestWakeLock, samplingGapThresholdMs, session, trackingProvider, wakeLockEnabled]);

  useEffect(() => {
    if (!session || !wakeLockEnabled) {
      void releaseWakeLock();
      return;
    }

    if (!wakeLockSupported || lifecycleProvider.getSnapshot().visibility === "background") {
      return;
    }

    void requestWakeLock();
  }, [lifecycleProvider, releaseWakeLock, requestWakeLock, session, wakeLockEnabled, wakeLockSupported]);

  const setWakeLockEnabled = useCallback((enabled: boolean) => {
    writeWakeLockPreference(workspaceId, enabled);
    setWakeLockEnabledState(enabled);

    if (!enabled) {
      setWakeLockError(null);
      void releaseWakeLock();
      return;
    }

    if (sessionRef.current) {
      void requestWakeLock();
    }
  }, [releaseWakeLock, requestWakeLock, workspaceId]);

  const startTrip = useCallback(
    async (options: StartTripOptions) => {
      const existing = readTripSession(workspaceId);
      if (existing) {
        setSession(existing);
        return false;
      }

      const created: TripSessionState = {
        id: crypto.randomUUID(),
        workspaceId,
        journeyId: options.journeyId,
        journeySlug: options.journeySlug,
        journeyTitle: options.journeyTitle,
        startedAt: nowIso(),
        lastSampleAt: nowIso(),
        totalDistanceKm: 0,
        samples: [],
        hiddenAt: null,
        hadTrackingGap: false,
        lastBackgroundDurationMs: null,
        lastVisibilityResumeAt: null,
      };

      const nextTrackingSessionStatus = await trackingProvider.startTrackingSession({
        sessionId: created.id,
        workspaceId,
        journeyId: options.journeyId,
        journeySlug: options.journeySlug,
        journeyTitle: options.journeyTitle,
        startedAt: created.startedAt,
        samplingIntervalSeconds: gpsSamplingIntervalSeconds,
      });
      setTrackingSessionStatus(nextTrackingSessionStatus);

      persistSession(created);
      setLastError(null);

      if (!geolocationSupported) {
        const updated = { ...created, geolocationUnavailable: true };
        persistSession(updated);
        setLastError("location-unsupported");
        return true;
      }

      if (wakeLockEnabled) {
        void requestWakeLock();
      }

      await new Promise((resolve) => window.setTimeout(resolve, 0));
      void captureSample();
      return true;
    },
    [captureSample, geolocationSupported, gpsSamplingIntervalSeconds, persistSession, requestWakeLock, trackingProvider, wakeLockEnabled, workspaceId],
  );

  const endTrip = useCallback(async () => {
    const current = readTripSession(workspaceId);
    if (!current) {
      return null;
    }

    if (geolocationSupported) {
      await captureSample();
    }

    await trackingProvider.getTrackingSessionStatus();
    await reconcileProviderSampleStore();

    const latest = readTripSession(workspaceId) ?? current;
    const endedAt = nowIso();
    const elapsedMs = Math.max(0, new Date(endedAt).getTime() - new Date(latest.startedAt).getTime());
    const summary: CompletedTripSummary = {
      journeyId: latest.journeyId,
      journeySlug: latest.journeySlug,
      journeyTitle: latest.journeyTitle,
      startedAt: latest.startedAt,
      endedAt,
      distanceKm: latest.totalDistanceKm,
      elapsedMs,
      sampleCount: latest.samples.length,
      samples: latest.samples,
      hadTrackingGaps: Boolean(latest.hadTrackingGap),
      routePolyline: buildRoutePolyline(latest.samples),
      stopSuggestions: detectStopSuggestions(latest.samples),
    };

    const nextTrackingSessionStatus = await trackingProvider.stopTrackingSession();
    setTrackingSessionStatus(nextTrackingSessionStatus);
    await releaseWakeLock();
    persistSession(null);
    return summary;
  }, [captureSample, geolocationSupported, persistSession, reconcileProviderSampleStore, releaseWakeLock, trackingProvider, workspaceId]);

  const elapsedMs = useMemo(() => {
    if (!session) {
      return 0;
    }

    return Math.max(0, Date.now() - new Date(session.startedAt).getTime());
  }, [session]);

  const timeSinceLastSampleMs = useMemo(() => {
    if (!session?.lastSampleAt) {
      return null;
    }

    return Math.max(0, Date.now() - new Date(session.lastSampleAt).getTime());
  }, [session]);

  const trackingMayBePaused = Boolean(
    session && (
      session.hiddenAt
      || session.hadTrackingGap
      || (timeSinceLastSampleMs !== null && timeSinceLastSampleMs >= samplingGapThresholdMs)
    ),
  );

  return {
    geolocationSupported,
    trackingMode: trackingProvider.getTrackingMode(),
    trackingPermissionState,
    trackingAvailability,
    trackingSessionStatus,
    trackingRecoveryState,
    wakeLockSupported,
    wakeLockEnabled,
    wakeLockActive,
    wakeLockError,
    isTracking: trackingSessionStatus.state === "active" && Boolean(session),
    session,
    elapsedMs,
    trackingMayBePaused,
    resumedAfterBackgroundMs: session?.lastVisibilityResumeAt ? session.lastBackgroundDurationMs ?? null : null,
    hadTrackingGap: Boolean(session?.hadTrackingGap),
    lastError,
    startTrip,
    endTrip,
    captureSample,
    setWakeLockEnabled,
  };
}
