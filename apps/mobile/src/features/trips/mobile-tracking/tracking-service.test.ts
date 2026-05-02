import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileTripSession } from "../trip-workflow";

const storage = new Map<string, string>();
let platformOs = "android";
let appOwnership = "guest";
let taskActive = false;
let foregroundPermission = "granted";
let backgroundPermission = "granted";
let locationServicesEnabled = true;
let taskDefined = false;
let backgroundTaskCallback: ((event: {
  data?: {
    locations?: {
      coords: { latitude: number; longitude: number; accuracy: number | null };
      timestamp: number;
    }[];
  };
  error?: unknown;
}) => Promise<void>) | null = null;
const startLocationUpdatesAsync = vi.fn(async () => {
  taskActive = true;
});
const stopLocationUpdatesAsync = vi.fn(async () => {
  taskActive = false;
});
let foregroundLocationCallback: ((location: {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
}) => void) | null = null;
const watchPositionAsync = vi.fn(async (_options, callback) => {
  foregroundLocationCallback = callback;
  return {
    remove: vi.fn(() => {
      foregroundLocationCallback = null;
    }),
  };
});

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformOs;
    },
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    get appOwnership() {
      return appOwnership;
    },
  },
}));

vi.mock("expo-task-manager", () => ({
  isAvailableAsync: vi.fn(async () => true),
  isTaskDefined: vi.fn(() => taskDefined),
  defineTask: vi.fn((_taskName, callback) => {
    taskDefined = true;
    backgroundTaskCallback = callback;
  }),
}));

vi.mock("expo-location", () => ({
  Accuracy: {
    Balanced: 3,
  },
  getForegroundPermissionsAsync: vi.fn(async () => ({ status: foregroundPermission })),
  getBackgroundPermissionsAsync: vi.fn(async () => ({ status: backgroundPermission })),
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: foregroundPermission })),
  requestBackgroundPermissionsAsync: vi.fn(async () => ({ status: backgroundPermission })),
  hasServicesEnabledAsync: vi.fn(async () => locationServicesEnabled),
  hasStartedLocationUpdatesAsync: vi.fn(async () => taskActive),
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
  watchPositionAsync,
}));

vi.mock("../../../lib/storage/mobile-storage", () => ({
  mobileStorage: {
    async getItem(key: string) {
      return storage.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      storage.set(key, value);
    },
    async removeItem(key: string) {
      storage.delete(key);
    },
  },
}));

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "active",
    startedAt: "2026-04-12T00:00:00.000Z",
    distanceMeters: 0,
    title: "Trip 12/04/2026",
    sampleCount: 0,
    captureMode: "tracking",
    syncState: "localOnly",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("mobileTrackingService", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    storage.clear();
    platformOs = "android";
    appOwnership = "guest";
    taskActive = false;
    taskDefined = false;
    backgroundTaskCallback = null;
    foregroundPermission = "granted";
    backgroundPermission = "granted";
    locationServicesEnabled = true;
    startLocationUpdatesAsync.mockClear();
    stopLocationUpdatesAsync.mockClear();
    watchPositionAsync.mockClear();
    foregroundLocationCallback = null;
  });

  it("starts Android tracking for a trip", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:00:05.000Z"));
    const { mobileTrackingService } = await import("./tracking-service");

    const diagnostics = await mobileTrackingService.startTracking(createTrip());

    expect(startLocationUpdatesAsync).toHaveBeenCalledWith(
      "gigeze-android-trip-tracking",
      expect.objectContaining({
        distanceInterval: 10,
        foregroundService: expect.objectContaining({
          notificationTitle: "GigEze trip tracking",
        }),
      }),
    );
    expect(watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceInterval: 2,
        timeInterval: 2000,
      }),
      expect.any(Function),
    );
    expect(diagnostics.active).toBe(true);
    expect(diagnostics.sessionId).toBe("trip-1");
    expect(diagnostics.runtimeMode).toBe("development-build");
    expect(diagnostics.supportsBackgroundTracking).toBe(true);
    expect(diagnostics.backgroundTaskDefined).toBe(true);
    expect(diagnostics.backgroundTaskStarted).toBe(true);
    expect(diagnostics.foregroundWatchActive).toBe(true);
    expect(diagnostics.backgroundDiagnosis).toBe("waiting-for-callback");
    expect(diagnostics.healthState).toBe("active-no-samples");
    vi.useRealTimers();
  });

  it("does not claim background start success when Location start fails", async () => {
    startLocationUpdatesAsync.mockRejectedValueOnce(new Error("background start denied"));
    const { mobileTrackingService } = await import("./tracking-service");

    const diagnostics = await mobileTrackingService.startTracking(createTrip());

    expect(diagnostics.backgroundTaskStarted).toBe(false);
    expect(diagnostics.active).toBe(false);
    expect(diagnostics.stateMatchesExpectation).toBe(false);
    expect(diagnostics.lastError).toBe("background start denied");
    expect(diagnostics.backgroundDiagnosis).toBe("task-not-started");
    expect(watchPositionAsync).toHaveBeenCalled();
  });

  it("imports foreground samples while the trip screen is open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:00:05.000Z"));
    const { mobileTrackingService } = await import("./tracking-service");
    const trip = createTrip({ startedAt: "2026-04-12T00:00:00.000Z" });
    await mobileTrackingService.startTracking(trip);

    foregroundLocationCallback?.({
      coords: {
        latitude: -33.86,
        longitude: 151.2,
        accuracy: 8,
      },
      timestamp: new Date("2026-04-12T00:00:05.000Z").getTime(),
    });

    const result = await mobileTrackingService.drainSamples(trip);

    expect(result.importedCount).toBe(1);
    expect(result.importedSampleCount).toBe(1);
    expect(result.lastSampleAt).toBeTruthy();
    expect(result.diagnostics.foregroundSampleCount).toBe(1);
    expect(result.diagnostics.backgroundSampleCount).toBe(0);
    expect(result.diagnostics.healthState).toBe("active-foreground-only");
    vi.useRealTimers();
  });

  it("records background callbacks and imports background samples", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);

    await backgroundTaskCallback?.({
      data: {
        locations: [
          {
            coords: {
              latitude: -33.87,
              longitude: 151.21,
              accuracy: 7,
            },
            timestamp: 2,
          },
        ],
      },
    });

    const result = await mobileTrackingService.drainSamples(trip);

    expect(result.importedCount).toBe(1);
    expect(result.diagnostics.backgroundTaskCallbackCount).toBe(1);
    expect(result.diagnostics.lastBackgroundTaskCallbackAt).toBeTruthy();
    expect(result.diagnostics.lastBackgroundTaskError).toBeNull();
    expect(result.diagnostics.foregroundSampleCount).toBe(0);
    expect(result.diagnostics.backgroundSampleCount).toBe(1);
    expect(result.diagnostics.lastBackgroundSampleAt).toBe("1970-01-01T00:00:00.002Z");
  });

  it("keeps separate counts for mixed foreground and background samples", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);

    foregroundLocationCallback?.({
      coords: {
        latitude: -33.86,
        longitude: 151.2,
        accuracy: 8,
      },
      timestamp: 1,
    });
    await backgroundTaskCallback?.({
      data: {
        locations: [
          {
            coords: {
              latitude: -33.87,
              longitude: 151.21,
              accuracy: 7,
            },
            timestamp: 2,
          },
        ],
      },
    });

    const result = await mobileTrackingService.drainSamples(trip);

    expect(result.importedSampleCount).toBe(2);
    expect(result.diagnostics.foregroundSampleCount).toBe(1);
    expect(result.diagnostics.backgroundSampleCount).toBe(1);
    expect(result.diagnostics.lastForegroundSampleAt).toBe("1970-01-01T00:00:00.001Z");
    expect(result.diagnostics.lastBackgroundSampleAt).toBe("1970-01-01T00:00:00.002Z");
  });

  it("records background callback errors without dropping local tracking state", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);

    await backgroundTaskCallback?.({ error: new Error("native callback failed") });

    const diagnostics = await mobileTrackingService.getDiagnostics(trip);

    expect(diagnostics.backgroundTaskCallbackCount).toBe(1);
    expect(diagnostics.lastBackgroundTaskError).toBe("native callback failed");
    expect(diagnostics.active).toBe(true);
    expect(diagnostics.healthState).toBe("active-background-task-error");
    expect(diagnostics.backgroundDiagnosis).toBe("callback-error");
  });

  it("detects foreground-only tracking when background callbacks are stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:03:00.000Z"));
    const { mobileTrackingService } = await import("./tracking-service");
    const trip = createTrip({ startedAt: "2026-04-12T00:00:00.000Z" });
    await mobileTrackingService.startTracking(trip);
    foregroundLocationCallback?.({
      coords: {
        latitude: -33.86,
        longitude: 151.2,
        accuracy: 8,
      },
      timestamp: new Date("2026-04-12T00:02:55.000Z").getTime(),
    });

    const result = await mobileTrackingService.drainSamples(trip);

    expect(result.diagnostics.backgroundCallbackState).toBe("stale-callback");
    expect(result.diagnostics.foregroundSampleCount).toBe(1);
    expect(result.diagnostics.backgroundSampleCount).toBe(0);
    expect(result.diagnostics.healthState).toBe("active-background-not-firing");
    expect(result.diagnostics.backgroundDiagnosis).toBe("likely-os-background-restriction");
    expect(result.diagnostics.likelyBackgroundRestricted).toBe(true);
    expect(result.diagnostics.staleServiceDetected).toBe(true);
    vi.useRealTimers();
  });

  it("drains buffered samples, dedupes imports, and Gigs tracking", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingNativeBufferStore } = await import("./native-buffer-store");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);
    await trackingNativeBufferStore.appendSample({
      sessionId: trip.id,
      latitude: -33.86,
      longitude: 151.2,
      accuracyMeters: 8,
      timestampMs: 1,
      recordedAt: "2026-04-12T00:00:01.000Z",
      source: "expo-background-location",
      originId: "native-1",
    });
    await trackingNativeBufferStore.appendSample({
      sessionId: trip.id,
      latitude: -33.86,
      longitude: 151.2,
      accuracyMeters: 8,
      timestampMs: 1,
      recordedAt: "2026-04-12T00:00:01.000Z",
      source: "expo-background-location",
      originId: "native-1",
    });

    const result = await mobileTrackingService.stopTracking(trip);

    expect(stopLocationUpdatesAsync).toHaveBeenCalledWith("gigeze-android-trip-tracking");
    expect(result.importedCount).toBe(1);
    expect(result.importedSampleCount).toBe(1);
    expect(result.diagnostics.active).toBe(false);
    expect(result.diagnostics.healthState).toBe("stopped-cleanly");
    expect(result.diagnostics.stopVerified).toBe(true);
    expect(result.diagnostics.lastStopAt).toBeTruthy();
  });

  it("surfaces an unverified Gig without clearing the native tracking session", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSessionStorage } = await import("./session-storage");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);
    stopLocationUpdatesAsync.mockRejectedValueOnce(new Error("Gig failed"));

    const result = await mobileTrackingService.stopTracking(trip);
    const activeSession = await trackingSessionStorage.getActiveSession();

    expect(result.diagnostics.stopVerified).toBe(false);
    expect(result.diagnostics.actualServiceState).toBe("running");
    expect(result.diagnostics.healthState).toBe("stopped-unexpectedly");
    expect(result.diagnostics.lastError).toBe("Gig failed");
    expect(activeSession?.sessionId).toBe(trip.id);
  });

  it("treats Expo Android null-reference Gig cleanup as successful when the task is no longer active", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSessionStorage } = await import("./session-storage");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);
    stopLocationUpdatesAsync.mockImplementationOnce(async () => {
      taskActive = false;
      throw new Error(
        "Call to function 'ExpoLocation.stopLocationUpdatesAsync' has been rejected. Caused by: java.lang.NullPointerException: Attempt to invoke interface method 'java.util.Map android.content.SharedPreferences.getAll()' on a null object reference",
      );
    });

    const result = await mobileTrackingService.stopTracking(trip);
    const activeSession = await trackingSessionStorage.getActiveSession();

    expect(result.diagnostics.stopVerified).toBe(true);
    expect(result.diagnostics.actualServiceState).toBe("stopped");
    expect(result.diagnostics.healthState).toBe("stopped-cleanly");
    expect(result.diagnostics.lastError).toBeUndefined();
    expect(activeSession).toBeNull();
  });

  it("recovers an active tracked trip by restarting the Android task", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSessionStorage } = await import("./session-storage");
    const trip = createTrip();
    await trackingSessionStorage.saveActiveSession({
      sessionId: trip.id,
      startedAt: trip.startedAt,
      samplingIntervalSeconds: 15,
      lifecycleOwner: "expo-location-background-task",
      continuityMode: "continuous-background",
    });

    const diagnostics = await mobileTrackingService.recoverTracking(trip);

    expect(startLocationUpdatesAsync).toHaveBeenCalled();
    expect(diagnostics.active).toBe(true);
    expect(diagnostics.sessionId).toBe(trip.id);
    expect(diagnostics.operationState).toBe("recovering");
    expect(diagnostics.lastRecoveryAt).toBeTruthy();
  });

  it("recovers when a local active trip exists but tracking metadata is missing", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSessionStorage } = await import("./session-storage");
    const trip = createTrip();

    const diagnostics = await mobileTrackingService.recoverTracking(trip);
    const activeSession = await trackingSessionStorage.getActiveSession();

    expect(startLocationUpdatesAsync).toHaveBeenCalled();
    expect(activeSession?.sessionId).toBe(trip.id);
    expect(diagnostics.operationState).toBe("recovering");
    expect(diagnostics.lastError).toBe("tracking-session-missing-recovered");
  });

  it("surfaces a running tracking task when the local active trip is missing", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSessionStorage } = await import("./session-storage");
    await trackingSessionStorage.saveActiveSession({
      sessionId: "orphan-session",
      startedAt: "2026-04-12T00:00:00.000Z",
      samplingIntervalSeconds: 15,
      lifecycleOwner: "expo-location-background-task",
      continuityMode: "continuous-background",
    });
    taskActive = true;

    const diagnostics = await mobileTrackingService.recoverTracking(null);

    expect(diagnostics.sessionMismatch).toBe(true);
    expect(diagnostics.actualServiceState).toBe("mismatch");
    expect(diagnostics.lastError).toBe("tracking-task-running-without-active-trip");
  });

  it("fails safely when native tracking metadata belongs to another session", async () => {
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSessionStorage } = await import("./session-storage");
    await trackingSessionStorage.saveActiveSession({
      sessionId: "other-trip",
      startedAt: "2026-04-12T00:00:00.000Z",
      samplingIntervalSeconds: 15,
      lifecycleOwner: "expo-location-background-task",
      continuityMode: "continuous-background",
    });

    const result = await mobileTrackingService.drainSamples(createTrip());

    expect(result.importedCount).toBe(0);
    expect(result.diagnostics.sessionMismatch).toBe(true);
    expect(result.diagnostics.healthState).toBe("session-mismatch");
    expect(result.diagnostics.lastError).toBe("native-session-mismatch");
  });

  it("reports unsupported tracking outside Android", async () => {
    platformOs = "ios";
    const { mobileTrackingService } = await import("./tracking-service");

    const diagnostics = await mobileTrackingService.startTracking(createTrip());

    expect(diagnostics.availability).toEqual({ status: "unavailable", reason: "not-android" });
    expect(diagnostics.active).toBe(false);
  });

  it("reports Expo Go as unsupported for real Android background tracking", async () => {
    appOwnership = "expo";
    const { mobileTrackingService } = await import("./tracking-service");

    const diagnostics = await mobileTrackingService.startTracking(createTrip());

    expect(diagnostics.runtimeMode).toBe("expo-go");
    expect(diagnostics.supportsBackgroundTracking).toBe(false);
    expect(diagnostics.availability).toEqual({ status: "unavailable", reason: "unsupported-runtime" });
    expect(diagnostics.healthState).toBe("unsupported-runtime");
    expect(startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("maps permission and provider failures into explicit health states", async () => {
    const { mobileTrackingService } = await import("./tracking-service");

    foregroundPermission = "denied";
    let diagnostics = await mobileTrackingService.startTracking(createTrip());
    expect(diagnostics.availability).toMatchObject({ status: "unavailable", reason: "permission-denied" });
    expect(diagnostics.healthState).toBe("permission-missing");
    expect(diagnostics.foregroundPermission).toBe("denied");

    foregroundPermission = "granted";
    locationServicesEnabled = false;
    diagnostics = await mobileTrackingService.startTracking(createTrip());
    expect(diagnostics.availability).toMatchObject({ status: "unavailable", reason: "location-services-disabled" });
    expect(diagnostics.healthState).toBe("provider-disabled");
    expect(diagnostics.locationServicesEnabled).toBe(false);
  });

  it("detects stale sample arrival for active Android tracking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:03:00.000Z"));
    const { mobileTrackingService } = await import("./tracking-service");
    const { trackingSampleStore } = await import("./sample-store");
    const trip = createTrip();
    await mobileTrackingService.startTracking(trip);
    await trackingSampleStore.appendSample({
      sessionId: trip.id,
      latitude: -33.86,
      longitude: 151.2,
      accuracyMeters: 8,
      timestampMs: 1,
      recordedAt: "2026-04-12T00:00:00.000Z",
      source: "expo-background-location",
      originId: "sample-1",
    });

    const diagnostics = await mobileTrackingService.getDiagnostics(trip);

    expect(diagnostics.secondsSinceLastSample).toBe(180);
    expect(diagnostics.sampleArrivalState).toBe("stale");
    expect(diagnostics.healthState).toBe("active-stale");
    expect(diagnostics.staleServiceDetected).toBe(true);
    vi.useRealTimers();
  });
});
