// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  resetAppLifecycleProviderForTests,
  setAppLifecycleProviderForTests,
  type AppLifecycleProvider,
} from "@/features/mobile/lifecycle-provider";
import {
  resetAppPersistenceProviderForTests,
  setAppPersistenceProviderForTests,
  type AppPersistenceProvider,
} from "@/features/mobile/persistence";
import {
  resetTripTrackingProviderForTests,
  setTripTrackingProviderForTests,
  type TripTrackingProvider,
  type TripTrackingSessionStatus,
} from "@/features/mobile/tracking-provider";
import { createTrackingSampleStore } from "@/features/mobile/tracking-sample-store";
import { useTripTracker } from "@/features/trips/use-trip-tracker";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type TrackerSnapshot = ReturnType<typeof useTripTracker>;

function createPersistenceHarness(): AppPersistenceProvider {
  const store = new Map<string, string>();

  return {
    kind: "in-memory",
    isStorageAvailable: () => true,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    emit: () => undefined,
    subscribe: () => () => undefined,
    subscribeStorageChanges: () => () => undefined,
  };
}

function createLifecycleHarness(): AppLifecycleProvider {
  return {
    kind: "fallback",
    getSnapshot: () => ({
      visibility: "active",
      isOnline: true,
      runtimeCapabilities: {
        runtime: {
          mode: "web",
          isBrowser: true,
          isNativeShell: false,
          platform: "web",
        },
        geolocationSupported: true,
        persistentStorageAvailable: true,
        wakeLockSupported: false,
        visibilityEventsSupported: false,
        networkStatusApiSupported: false,
        backgroundLocationSupported: false,
        durableDeviceStorageSupported: false,
        appLifecycleEventsSupported: false,
        nativePermissionOrchestrationSupported: false,
      },
    }),
    subscribe: () => () => undefined,
  };
}

describe("useTripTracker", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    resetTripTrackingProviderForTests();
    resetAppPersistenceProviderForTests();
    resetAppLifecycleProviderForTests();
    root = null;
    container = null;
    vi.useRealTimers();
  });

  it("keeps browser trip flow working while using provider-owned tracking sessions", async () => {
    const persistence = createPersistenceHarness();
    setAppPersistenceProviderForTests(persistence);
    setAppLifecycleProviderForTests(createLifecycleHarness());

    let sessionStatus: TripTrackingSessionStatus = {
      state: "idle",
      session: null,
    };
    let startCalls = 0;
    let stopCalls = 0;

    const trackingProvider: TripTrackingProvider = {
      kind: "browser",
      getTrackingMode: () => "foreground",
      getBackgroundReadiness: () => ({
        status: "foreground-only",
        lifecycleOwner: "react",
        continuityMode: "sample-on-demand",
        sampleStoreKind: "app-persistence-json",
        notes: [],
      }),
      getSampleStore: () => createTrackingSampleStore(),
      isGeolocationSupported: () => true,
      isWakeLockSupported: () => false,
      getPermissionState: async () => "granted",
      getAvailability: async () => ({ status: "available" }),
      startTrackingSession: async (input) => {
        startCalls += 1;
        sessionStatus = {
          state: "active",
          session: {
            sessionId: input.sessionId,
            workspaceId: input.workspaceId,
            journeyId: input.journeyId,
            journeySlug: input.journeySlug,
            journeyTitle: input.journeyTitle,
            startedAt: input.startedAt,
            samplingIntervalSeconds: input.samplingIntervalSeconds,
            mode: "foreground",
            continuityMode: "sample-on-demand",
            lifecycleOwner: "react",
          },
        };
        return sessionStatus;
      },
      stopTrackingSession: async () => {
        stopCalls += 1;
        sessionStatus = {
          state: "idle",
          session: null,
        };
        return sessionStatus;
      },
      getTrackingSessionStatus: async () => sessionStatus,
      startContinuousTrackingSession: async (input) => trackingProvider.startTrackingSession(input),
      stopContinuousTrackingSession: async () => trackingProvider.stopTrackingSession(),
      getContinuousTrackingSessionStatus: async () => sessionStatus,
      recoverActiveSession: async () => ({
        status: sessionStatus.state === "active" ? "recovered" : "none",
        sessionStatus,
      }),
      sampleCurrentPosition: async () => ({
        position: {
          latitude: -33.86,
          longitude: 151.2,
          accuracyMeters: 5,
          timestampMs: Date.now(),
        },
      }),
      requestScreenWakeLock: async () => null,
    };
    setTripTrackingProviderForTests(trackingProvider);

    let latestTracker: TrackerSnapshot | null = null;

    function getTrackerSnapshot() {
      if (!latestTracker) {
        throw new Error("Tracker snapshot not initialized");
      }

      return latestTracker;
    }

    function Harness() {
      const tracker = useTripTracker("workspace-1", 30);

      useEffect(() => {
        latestTracker = tracker;
      });

      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness />);
    });

    await act(async () => {
      await getTrackerSnapshot().startTrip({
        journeyId: "Tour-1",
        journeySlug: "Tour-1",
        journeyTitle: "Trip one",
      });
    });

    expect(getTrackerSnapshot().isTracking).toBe(true);
    expect(getTrackerSnapshot().trackingSessionStatus.state).toBe("active");
    expect(getTrackerSnapshot().session?.samples.length).toBe(1);
    expect(startCalls).toBeGreaterThanOrEqual(1);

    await act(async () => {
      await getTrackerSnapshot().endTrip();
    });

    expect(getTrackerSnapshot().isTracking).toBe(false);
    expect(getTrackerSnapshot().trackingSessionStatus.state).toBe("idle");
    expect(stopCalls).toBe(1);
  });

  it("periodically drains provider samples for active native-service sessions", async () => {
    vi.useFakeTimers();
    const persistence = createPersistenceHarness();
    setAppPersistenceProviderForTests(persistence);
    setAppLifecycleProviderForTests(createLifecycleHarness());

    const sampleStore = createTrackingSampleStore();
    let sessionStatus: TripTrackingSessionStatus = {
      state: "idle",
      session: null,
    };
    let statusCalls = 0;

    const trackingProvider: TripTrackingProvider = {
      kind: "browser",
      getTrackingMode: () => "background-capable",
      getBackgroundReadiness: () => ({
        status: "background-capable",
        lifecycleOwner: "native-service",
        continuityMode: "continuous-background",
        sampleStoreKind: "app-persistence-json",
        notes: [],
      }),
      getSampleStore: () => sampleStore,
      isGeolocationSupported: () => true,
      isWakeLockSupported: () => false,
      getPermissionState: async () => "granted",
      getAvailability: async () => ({ status: "available" }),
      startTrackingSession: async (input) => {
        sessionStatus = {
          state: "active",
          session: {
            sessionId: input.sessionId,
            workspaceId: input.workspaceId,
            journeyId: input.journeyId,
            journeySlug: input.journeySlug,
            journeyTitle: input.journeyTitle,
            startedAt: input.startedAt,
            samplingIntervalSeconds: input.samplingIntervalSeconds,
            mode: "background-capable",
            continuityMode: "continuous-background",
            lifecycleOwner: "native-service",
          },
        };
        return sessionStatus;
      },
      stopTrackingSession: async () => {
        sessionStatus = {
          state: "idle",
          session: null,
        };
        return sessionStatus;
      },
      getTrackingSessionStatus: async () => {
        statusCalls += 1;
        return sessionStatus;
      },
      startContinuousTrackingSession: async (input) => trackingProvider.startTrackingSession(input),
      stopContinuousTrackingSession: async () => trackingProvider.stopTrackingSession(),
      getContinuousTrackingSessionStatus: async () => trackingProvider.getTrackingSessionStatus(),
      recoverActiveSession: async () => ({
        status: sessionStatus.state === "active" ? "recovered" : "none",
        sessionStatus,
      }),
      sampleCurrentPosition: async () => ({
        position: {
          latitude: -33.86,
          longitude: 151.2,
          accuracyMeters: 5,
          timestampMs: Date.now(),
        },
      }),
      requestScreenWakeLock: async () => null,
    };
    setTripTrackingProviderForTests(trackingProvider);

    let latestTracker: TrackerSnapshot | null = null;

    function getTrackerSnapshot() {
      if (!latestTracker) {
        throw new Error("Tracker snapshot not initialized");
      }

      return latestTracker;
    }

    function Harness() {
      const tracker = useTripTracker("workspace-1", 30);

      useEffect(() => {
        latestTracker = tracker;
      });

      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness />);
    });

    await act(async () => {
      const startTrip = getTrackerSnapshot().startTrip({});
      await vi.runOnlyPendingTimersAsync();
      await startTrip;
    });

    const callsBeforePeriodicDrain = statusCalls;

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(statusCalls).toBeGreaterThan(callsBeforePeriodicDrain);
  });
});

