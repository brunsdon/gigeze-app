import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { MobileTripSession } from "../trip-workflow";
import { androidTripTrackingTaskName } from "./android-background-task";
import { backgroundTaskDiagnosticsStore } from "./background-task-diagnostics-store";
import { trackingNativeBufferStore } from "./native-buffer-store";
import { trackingSampleStore } from "./sample-store";
import { trackingSessionStorage, type TrackingSessionMetadata } from "./session-storage";
import type {
  TrackingAvailability,
  TrackingBackgroundDiagnosis,
  TrackingBackgroundCallbackState,
  TrackingDiagnostics,
  TrackingDrainResult,
  TrackingHealthState,
  TrackingRuntimeMode,
  TrackingSampleArrivalState,
  TrackingSampleRecord,
} from "./types";

const defaultSamplingIntervalSeconds = 15;
const foregroundSamplingIntervalMs = 2000;
const foregroundDistanceIntervalMeters = 2;
const staleSampleThresholdSeconds = defaultSamplingIntervalSeconds * 4;
const locationUpdatesOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: defaultSamplingIntervalSeconds * 1000,
  distanceInterval: 10,
  foregroundService: {
    notificationTitle: "GigEze trip tracking",
    notificationBody: "Recording trip location samples in the background.",
  },
  pausesUpdatesAutomatically: false,
};
let foregroundLocationSubscription: Location.LocationSubscription | null = null;

function getLocationTimestampMs(location: Location.LocationObject) {
  return Number.isFinite(location.timestamp) ? location.timestamp : Date.now();
}

async function appendForegroundSample(sessionId: string, location: Location.LocationObject) {
  const timestampMs = getLocationTimestampMs(location);
  await trackingNativeBufferStore.appendSample({
    sessionId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy ?? null : null,
    timestampMs,
    recordedAt: new Date(timestampMs).toISOString(),
    source: "expo-foreground-location",
    originId: `${sessionId}:foreground:${timestampMs}:${location.coords.latitude}:${location.coords.longitude}`,
  });
}

async function stopForegroundWatch() {
  foregroundLocationSubscription?.remove();
  foregroundLocationSubscription = null;
}

async function startForegroundWatch(sessionId: string) {
  await stopForegroundWatch();
  foregroundLocationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: foregroundSamplingIntervalMs,
      distanceInterval: foregroundDistanceIntervalMeters,
    },
    (location) => {
      void appendForegroundSample(sessionId, location).catch((error: unknown) => {
        console.warn("[gigeze/mobile] foreground tracking sample failed", error);
      });
    },
  );
}

function getRuntimeMode(): TrackingRuntimeMode {
  if (Constants.appOwnership === "expo") {
    return "expo-go";
  }

  if (Constants.appOwnership === "guest") {
    return "development-build";
  }

  if (Constants.appOwnership === "standalone") {
    return "standalone";
  }

  return "unknown";
}

function getSupportsBackgroundTracking(runtimeMode = getRuntimeMode()) {
  return Platform.OS === "android" && runtimeMode !== "expo-go";
}

function getSecondsSinceTimestamp(timestampIso: string | null | undefined, now = new Date()) {
  if (!timestampIso) {
    return undefined;
  }

  const timestamp = new Date(timestampIso).getTime();
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return Math.max(0, Math.floor((now.getTime() - timestamp) / 1000));
}

function getLastSampleBySource(samples: ArrayLikeSample[], source: TrackingSampleRecord["source"]) {
  return samples
    .filter((sample) => sample.source === source)
    .sort((firstSample, secondSample) => new Date(firstSample.recordedAt).getTime() - new Date(secondSample.recordedAt).getTime())
    .at(-1);
}

function getSourceSummary(importedSamples: TrackingSampleRecord[], nativeSamples: Omit<TrackingSampleRecord, "sequence">[]) {
  const samples = [...importedSamples, ...nativeSamples];
  const foregroundSampleCount = samples.filter((sample) => sample.source === "expo-foreground-location").length;
  const backgroundSampleCount = samples.filter((sample) => sample.source === "expo-background-location").length;
  const lastForegroundSample = getLastSampleBySource(samples, "expo-foreground-location");
  const lastBackgroundSample = getLastSampleBySource(samples, "expo-background-location");

  return {
    foregroundSampleCount,
    backgroundSampleCount,
    lastForegroundSampleAt: lastForegroundSample?.recordedAt ?? null,
    lastBackgroundSampleAt: lastBackgroundSample?.recordedAt ?? null,
  };
}

function getBackgroundCallbackState(options: {
  supportsBackgroundTracking: boolean;
  backgroundTaskStarted: boolean;
  lastBackgroundTaskCallbackAt: string | null;
  sessionStartedAt?: string;
  now: Date;
}): TrackingBackgroundCallbackState {
  if (!options.supportsBackgroundTracking) {
    return "unsupported";
  }

  if (!options.backgroundTaskStarted) {
    return "not-started";
  }

  const secondsSinceLastCallback = getSecondsSinceTimestamp(options.lastBackgroundTaskCallbackAt, options.now);
  if (secondsSinceLastCallback !== undefined) {
    return secondsSinceLastCallback > staleSampleThresholdSeconds ? "stale-callback" : "recent-callback";
  }

  const secondsSinceTrackingStarted = getSecondsSinceTimestamp(options.sessionStartedAt, options.now);
  return secondsSinceTrackingStarted !== undefined && secondsSinceTrackingStarted > staleSampleThresholdSeconds
    ? "stale-callback"
    : "waiting-for-callback";
}

function getSampleArrivalState(options: {
  expectedServiceState: TrackingDiagnostics["expectedServiceState"];
  active: boolean;
  importedSampleCount: number;
  secondsSinceLastSample?: number;
}): TrackingSampleArrivalState {
  if (options.expectedServiceState !== "running") {
    return "not-tracking";
  }

  if (!options.active) {
    return "unknown";
  }

  if (options.importedSampleCount === 0 || options.secondsSinceLastSample === undefined) {
    return "waiting-for-first-sample";
  }

  return options.secondsSinceLastSample > staleSampleThresholdSeconds ? "stale" : "fresh";
}

export function deriveTrackingHealthState(options: {
  availability: TrackingAvailability;
  active: boolean;
  expectedServiceState: TrackingDiagnostics["expectedServiceState"];
  stateMatchesExpectation: boolean;
  sessionMismatch: boolean;
  sampleArrivalState: TrackingSampleArrivalState;
  backgroundCallbackState?: TrackingBackgroundCallbackState;
  lastBackgroundTaskError?: string | null;
  foregroundSampleCount?: number;
  backgroundSampleCount?: number;
}): TrackingHealthState {
  if (options.sessionMismatch) {
    return "session-mismatch";
  }

  if (options.availability.status === "unavailable") {
    if (options.availability.reason === "unsupported-runtime") {
      return "unsupported-runtime";
    }
    if (options.availability.reason === "permission-denied" || options.availability.reason === "background-permission-denied") {
      return "permission-missing";
    }
    if (options.availability.reason === "location-services-disabled") {
      return "provider-disabled";
    }
    return "unavailable";
  }

  if (options.lastBackgroundTaskError) {
    return "active-background-task-error";
  }

  if (options.expectedServiceState === "stopped") {
    return options.active || !options.stateMatchesExpectation ? "stopped-unexpectedly" : "stopped-cleanly";
  }

  if (!options.active || !options.stateMatchesExpectation) {
    return "stopped-unexpectedly";
  }

  if (options.sampleArrivalState === "stale") {
    return "active-stale";
  }

  if (options.sampleArrivalState === "waiting-for-first-sample") {
    return "active-no-samples";
  }

  if (options.backgroundCallbackState === "stale-callback") {
    return "active-background-not-firing";
  }

  if ((options.foregroundSampleCount ?? 0) > 0 && (options.backgroundSampleCount ?? 0) === 0) {
    return "active-foreground-only";
  }

  return "active-healthy";
}

function getBackgroundDiagnosis(options: {
  availability: TrackingAvailability;
  supportsBackgroundTracking: boolean;
  backgroundTaskDefined: boolean;
  backgroundTaskStarted: boolean;
  backgroundCallbackState: TrackingBackgroundCallbackState;
  lastBackgroundTaskError?: string | null;
  foregroundSampleCount: number;
  backgroundSampleCount: number;
}): { diagnosis: TrackingBackgroundDiagnosis; message: string; likelyBackgroundRestricted: boolean } {
  if (!options.supportsBackgroundTracking || (options.availability.status === "unavailable" && options.availability.reason === "unsupported-runtime")) {
    return {
      diagnosis: "unsupported-runtime",
      message: "Android background tracking needs a development or standalone build; Expo Go cannot validate it.",
      likelyBackgroundRestricted: false,
    };
  }

  if (options.availability.status === "unavailable") {
    if (options.availability.reason === "permission-denied" || options.availability.reason === "background-permission-denied") {
      return {
        diagnosis: "permission-missing",
        message: "Foreground or background location permission is missing.",
        likelyBackgroundRestricted: false,
      };
    }

    if (options.availability.reason === "location-services-disabled") {
      return {
        diagnosis: "provider-disabled",
        message: "Device location services are disabled.",
        likelyBackgroundRestricted: false,
      };
    }

    if (options.availability.reason === "background-task-not-defined") {
      return {
        diagnosis: "task-not-defined",
        message: "The Expo background task is not defined in this runtime.",
        likelyBackgroundRestricted: false,
      };
    }
  }

  if (!options.backgroundTaskDefined) {
    return {
      diagnosis: "task-not-defined",
      message: "The Expo background task is not defined in this runtime.",
      likelyBackgroundRestricted: false,
    };
  }

  if (!options.backgroundTaskStarted) {
    return {
      diagnosis: "task-not-started",
      message: "The Android background location task is not currently started.",
      likelyBackgroundRestricted: false,
    };
  }

  if (options.lastBackgroundTaskError) {
    return {
      diagnosis: "callback-error",
      message: `The background task recorded an error: ${options.lastBackgroundTaskError}`,
      likelyBackgroundRestricted: false,
    };
  }

  if (options.backgroundCallbackState === "waiting-for-callback") {
    return {
      diagnosis: "waiting-for-callback",
      message: "Background task has started and is waiting for the first callback.",
      likelyBackgroundRestricted: false,
    };
  }

  if (options.backgroundCallbackState === "stale-callback") {
    const foregroundOnly = options.foregroundSampleCount > 0 && options.backgroundSampleCount === 0;
    return {
      diagnosis: foregroundOnly ? "likely-os-background-restriction" : "stale-callback",
      message: foregroundOnly
        ? "Foreground samples are arriving, but background callbacks are stale. This is likely an Android battery/background restriction or screen-lock policy."
        : "The background task has started, but callbacks are stale.",
      likelyBackgroundRestricted: foregroundOnly,
    };
  }

  if (options.foregroundSampleCount > 0 && options.backgroundSampleCount === 0) {
    return {
      diagnosis: "foreground-only",
      message: "Foreground samples are arriving, but no background samples have been imported yet.",
      likelyBackgroundRestricted: false,
    };
  }

  return {
    diagnosis: "none",
    message: "No background tracking issue detected.",
    likelyBackgroundRestricted: false,
  };
}

function createDiagnostics(options: {
  availability: TrackingAvailability;
  active: boolean;
  expectedServiceState: TrackingDiagnostics["expectedServiceState"];
  actualServiceState?: TrackingDiagnostics["actualServiceState"];
  operationState?: TrackingDiagnostics["operationState"];
  sessionId?: string;
  nativeBufferedCount?: number;
  importedSampleCount?: number;
  foregroundWatchActive?: boolean;
  foregroundSampleCount?: number;
  backgroundSampleCount?: number;
  lastForegroundSampleAt?: string | null;
  lastBackgroundSampleAt?: string | null;
  backgroundTaskDefined?: boolean;
  backgroundTaskStarted?: boolean;
  lastBackgroundTaskCallbackAt?: string | null;
  backgroundTaskCallbackCount?: number;
  lastBackgroundTaskError?: string | null;
  lastBackgroundTaskErrorAt?: string | null;
  sessionStartedAt?: string;
  lastSampleAt?: string;
  lastDrainAt?: string;
  lastDrainCount?: number;
  lastImportAt?: string;
  lastImportCount?: number;
  foregroundPermission?: string;
  backgroundPermission?: string;
  locationServicesEnabled?: boolean;
  sessionMismatch?: boolean;
  lastRecoveryAt?: string;
  lastStopAt?: string;
  stopVerified?: boolean;
  lastError?: string;
}): TrackingDiagnostics {
  const actualServiceState = options.actualServiceState ?? (options.active ? "running" : "stopped");
  const stateMatchesExpectation =
    options.expectedServiceState === "running" ? actualServiceState === "running" : actualServiceState === "stopped";
  const updatedAt = new Date();
  const secondsSinceLastSample = getSecondsSinceTimestamp(options.lastSampleAt, updatedAt);
  const importedSampleCount = options.importedSampleCount ?? 0;
  const runtimeMode = getRuntimeMode();
  const supportsBackgroundTracking = getSupportsBackgroundTracking(runtimeMode);
  const backgroundTaskStarted = options.backgroundTaskStarted ?? options.active;
  const backgroundTaskDefined = options.backgroundTaskDefined ?? false;
  const backgroundCallbackState = getBackgroundCallbackState({
    supportsBackgroundTracking,
    backgroundTaskStarted,
    lastBackgroundTaskCallbackAt: options.lastBackgroundTaskCallbackAt ?? null,
    sessionStartedAt: options.sessionStartedAt,
    now: updatedAt,
  });
  const sampleArrivalState = getSampleArrivalState({
    expectedServiceState: options.expectedServiceState,
    active: options.active,
    importedSampleCount,
    secondsSinceLastSample,
  });
  const healthState = deriveTrackingHealthState({
    availability: options.availability,
    active: options.active,
    expectedServiceState: options.expectedServiceState,
    stateMatchesExpectation,
    sessionMismatch: options.sessionMismatch ?? false,
    sampleArrivalState,
    backgroundCallbackState,
    lastBackgroundTaskError: options.expectedServiceState === "running" ? options.lastBackgroundTaskError : null,
    foregroundSampleCount: options.foregroundSampleCount,
    backgroundSampleCount: options.backgroundSampleCount,
  });
  const backgroundDiagnosis = getBackgroundDiagnosis({
    availability: options.availability,
    supportsBackgroundTracking,
    backgroundTaskDefined,
    backgroundTaskStarted,
    backgroundCallbackState,
    lastBackgroundTaskError: options.expectedServiceState === "running" ? options.lastBackgroundTaskError : null,
    foregroundSampleCount: options.foregroundSampleCount ?? 0,
    backgroundSampleCount: options.backgroundSampleCount ?? 0,
  });

  return {
    platform: Platform.OS,
    runtimeMode,
    supportsBackgroundTracking,
    availability: options.availability,
    healthState,
    sampleArrivalState,
    operationState: options.operationState ?? "idle",
    backgroundCallbackState,
    backgroundDiagnosis: backgroundDiagnosis.diagnosis,
    backgroundDiagnosisMessage: backgroundDiagnosis.message,
    likelyBackgroundRestricted: backgroundDiagnosis.likelyBackgroundRestricted,
    active: options.active,
    expectedServiceState: options.expectedServiceState,
    actualServiceState,
    stateMatchesExpectation,
    lifecycleOwner: Platform.OS === "android" ? "expo-location-background-task" : "unsupported",
    continuityMode: Platform.OS === "android" ? "continuous-background" : "unsupported",
    sessionId: options.sessionId,
    nativeBufferedCount: options.nativeBufferedCount ?? 0,
    importedSampleCount,
    foregroundWatchActive: options.foregroundWatchActive ?? Boolean(foregroundLocationSubscription),
    foregroundSampleCount: options.foregroundSampleCount ?? 0,
    backgroundSampleCount: options.backgroundSampleCount ?? 0,
    lastForegroundSampleAt: options.lastForegroundSampleAt ?? null,
    lastBackgroundSampleAt: options.lastBackgroundSampleAt ?? null,
    backgroundTaskDefined,
    backgroundTaskStarted,
    lastBackgroundTaskCallbackAt: options.lastBackgroundTaskCallbackAt ?? null,
    backgroundTaskCallbackCount: options.backgroundTaskCallbackCount ?? 0,
    lastBackgroundTaskError: options.lastBackgroundTaskError ?? null,
    lastBackgroundTaskErrorAt: options.lastBackgroundTaskErrorAt ?? null,
    lastSampleAt: options.lastSampleAt,
    lastDrainAt: options.lastDrainAt,
    lastDrainCount: options.lastDrainCount ?? 0,
    lastImportAt: options.lastImportAt,
    lastImportCount: options.lastImportCount ?? 0,
    secondsSinceLastSample,
    staleThresholdSeconds: staleSampleThresholdSeconds,
    foregroundPermission: options.foregroundPermission,
    backgroundPermission: options.backgroundPermission,
    locationServicesEnabled: options.locationServicesEnabled,
    staleServiceDetected:
      options.expectedServiceState === "running" &&
      (!stateMatchesExpectation || sampleArrivalState === "stale" || backgroundCallbackState === "stale-callback"),
    sessionMismatch: options.sessionMismatch ?? false,
    lastRecoveryAt: options.lastRecoveryAt,
    lastStopAt: options.lastStopAt,
    stopVerified: options.stopVerified,
    lastError: options.lastError,
    updatedAt: updatedAt.toISOString(),
  };
}

async function getAvailability(): Promise<TrackingAvailability & { foregroundPermission?: string; backgroundPermission?: string; locationServicesEnabled?: boolean }> {
  if (Platform.OS !== "android") {
    return { status: "unavailable", reason: "not-android" };
  }

  const runtimeMode = getRuntimeMode();
  if (!getSupportsBackgroundTracking(runtimeMode)) {
    return { status: "unavailable", reason: "unsupported-runtime" };
  }

  const taskManagerAvailable = await TaskManager.isAvailableAsync();
  if (!taskManagerAvailable) {
    return { status: "unavailable", reason: "task-manager-unavailable" };
  }

  if (!getTaskDefined()) {
    return { status: "unavailable", reason: "background-task-not-defined" };
  }

  const locationServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => undefined);
  if (locationServicesEnabled === false) {
    return { status: "unavailable", reason: "location-services-disabled", locationServicesEnabled };
  }

  const foregroundPermission = await Location.getForegroundPermissionsAsync();
  const backgroundPermission = await Location.getBackgroundPermissionsAsync();
  if (foregroundPermission.status !== "granted") {
    return {
      status: "unavailable",
      reason: "permission-denied",
      foregroundPermission: foregroundPermission.status,
      backgroundPermission: backgroundPermission.status,
      locationServicesEnabled,
    };
  }

  if (backgroundPermission.status !== "granted") {
    return {
      status: "unavailable",
      reason: "background-permission-denied",
      foregroundPermission: foregroundPermission.status,
      backgroundPermission: backgroundPermission.status,
      locationServicesEnabled,
    };
  }

  return {
    status: "available",
    foregroundPermission: foregroundPermission.status,
    backgroundPermission: backgroundPermission.status,
    locationServicesEnabled,
  };
}

async function requestAndroidPermissions() {
  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (foregroundPermission.status !== "granted") {
    return getAvailability();
  }

  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (backgroundPermission.status !== "granted") {
    return getAvailability();
  }

  return getAvailability();
}

async function getTaskActive() {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    return await Location.hasStartedLocationUpdatesAsync(androidTripTrackingTaskName);
  } catch {
    return false;
  }
}

function getTaskDefined() {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    return TaskManager.isTaskDefined(androidTripTrackingTaskName);
  } catch {
    return false;
  }
}

type ArrayLikeSample = Omit<TrackingSampleRecord, "sequence"> | TrackingSampleRecord;

function isBenignAndroidStopError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("SharedPreferences.getAll()") || error.message.includes("java.lang.NullPointerException");
}

export const mobileTrackingService = {
  async getDiagnostics(activeTrip?: MobileTripSession | null): Promise<TrackingDiagnostics> {
    const [availability, activeSession, isTaskActive, backgroundTaskSnapshot] = await Promise.all([
      getAvailability(),
      trackingSessionStorage.getActiveSession(),
      getTaskActive(),
      backgroundTaskDiagnosticsStore.getSnapshot(),
    ]);
    const sessionId = activeTrip?.id ?? activeSession?.sessionId;
    const sessionMismatch = Boolean(activeTrip?.id && activeSession?.sessionId && activeTrip.id !== activeSession.sessionId);
    const [nativeSamples, importedSamples, lastSample] = sessionId
      ? await Promise.all([
          trackingNativeBufferStore.listSamples(sessionId),
          trackingSampleStore.listSamples(sessionId),
          trackingSampleStore.getLastSample(sessionId),
        ])
      : [[], [], null];
    const importedSampleCount = Math.max(importedSamples.length, activeTrip?.sampleCount ?? 0);
    const sourceSummary = getSourceSummary(importedSamples, nativeSamples);

    return createDiagnostics({
      availability,
      active: isTaskActive,
      expectedServiceState: activeTrip ? "running" : "stopped",
      actualServiceState: sessionMismatch ? "mismatch" : isTaskActive ? "running" : "stopped",
      sessionId,
      nativeBufferedCount: nativeSamples.length,
      importedSampleCount,
      foregroundWatchActive: Boolean(foregroundLocationSubscription),
      ...sourceSummary,
      backgroundTaskDefined: getTaskDefined(),
      backgroundTaskStarted: isTaskActive,
      lastBackgroundTaskCallbackAt: backgroundTaskSnapshot.lastCallbackAt,
      backgroundTaskCallbackCount: backgroundTaskSnapshot.callbackCount,
      lastBackgroundTaskError: backgroundTaskSnapshot.lastError,
      lastBackgroundTaskErrorAt: backgroundTaskSnapshot.lastErrorAt,
      sessionStartedAt: activeTrip?.startedAt ?? activeSession?.startedAt,
      lastSampleAt: lastSample?.recordedAt ?? activeTrip?.lastSampleAt,
      lastDrainAt: activeSession?.lastDrainAt,
      lastImportAt: activeSession?.lastImportAt,
      foregroundPermission: "foregroundPermission" in availability ? availability.foregroundPermission : undefined,
      backgroundPermission: "backgroundPermission" in availability ? availability.backgroundPermission : undefined,
      locationServicesEnabled: "locationServicesEnabled" in availability ? availability.locationServicesEnabled : undefined,
      sessionMismatch,
      lastError: availability.status === "unavailable" ? availability.reason : undefined,
    });
  },
  async startTracking(trip: MobileTripSession) {
    if (Platform.OS !== "android") {
      const diagnostics = createDiagnostics({
        availability: { status: "unavailable", reason: "not-android" },
        active: false,
        expectedServiceState: "running",
        actualServiceState: "unknown",
        sessionId: trip.id,
        lastError: "Android background tracking only is supported in this slice.",
      });
      return diagnostics;
    }

    const availability = await requestAndroidPermissions();
    if (availability.status !== "available") {
      return createDiagnostics({
        availability,
        active: false,
        expectedServiceState: "running",
        actualServiceState: "stopped",
        sessionId: trip.id,
        foregroundPermission: "foregroundPermission" in availability ? availability.foregroundPermission : undefined,
        backgroundPermission: "backgroundPermission" in availability ? availability.backgroundPermission : undefined,
        locationServicesEnabled: "locationServicesEnabled" in availability ? availability.locationServicesEnabled : undefined,
        lastError: availability.reason,
      });
    }

    const activeSession = await trackingSessionStorage.getActiveSession();
    if (activeSession?.sessionId && activeSession.sessionId !== trip.id) {
      return createDiagnostics({
        availability,
        active: await getTaskActive(),
        expectedServiceState: "running",
        actualServiceState: "mismatch",
        sessionId: activeSession.sessionId,
        sessionMismatch: true,
        lastError: "different-session-already-active",
      });
    }

    const metadata: TrackingSessionMetadata = {
      sessionId: trip.id,
      startedAt: trip.startedAt,
      samplingIntervalSeconds: defaultSamplingIntervalSeconds,
      lifecycleOwner: "expo-location-background-task",
      continuityMode: "continuous-background",
    };
    await trackingSessionStorage.saveActiveSession(metadata);
    const taskAlreadyActive = await getTaskActive();
    if (!taskAlreadyActive) {
      try {
        await Location.startLocationUpdatesAsync(androidTripTrackingTaskName, locationUpdatesOptions);
      } catch (error) {
        await backgroundTaskDiagnosticsStore.recordError(error);
        await startForegroundWatch(trip.id).catch((foregroundError: unknown) => {
          console.warn("[gigeze/mobile] foreground tracking recovery after background start failure failed", foregroundError);
        });
        const diagnostics = await this.getDiagnostics(trip);
        return {
          ...diagnostics,
          active: false,
          actualServiceState: "stopped" as const,
          stateMatchesExpectation: false,
          lastError: error instanceof Error ? error.message : "Unable to start Android background tracking.",
          updatedAt: new Date().toISOString(),
        };
      }
    }

    try {
      await startForegroundWatch(trip.id);
    } catch (error) {
      await backgroundTaskDiagnosticsStore.recordError(error);
      const diagnostics = await this.getDiagnostics(trip);
      return {
        ...diagnostics,
        lastError: error instanceof Error ? error.message : "Unable to start foreground location watcher.",
        updatedAt: new Date().toISOString(),
      };
    }

    const startedDiagnostics = await this.getDiagnostics(trip);
    if (!startedDiagnostics.backgroundTaskStarted) {
      return {
        ...startedDiagnostics,
        lastError: "background-task-not-started",
        updatedAt: new Date().toISOString(),
      };
    }

    return startedDiagnostics;
  },
  async recoverTracking(activeTrip: MobileTripSession | null) {
    const activeSession = await trackingSessionStorage.getActiveSession();
    const diagnostics = await this.getDiagnostics(activeTrip);

    if (!activeTrip && activeSession?.sessionId) {
      return createDiagnostics({
        ...diagnostics,
        availability: diagnostics.availability,
        active: diagnostics.active,
        expectedServiceState: "stopped",
        actualServiceState: diagnostics.active ? "mismatch" : "stopped",
        sessionId: activeSession.sessionId,
        sessionMismatch: true,
        lastRecoveryAt: new Date().toISOString(),
        lastError: diagnostics.active ? "tracking-task-running-without-active-trip" : "tracking-session-without-active-trip",
      });
    }

    if (activeTrip && (!activeSession || activeSession.sessionId === activeTrip.id) && !diagnostics.active && diagnostics.availability.status === "available") {
      await trackingSessionStorage.saveActiveSession({
        sessionId: activeTrip.id,
        startedAt: activeTrip.startedAt,
        samplingIntervalSeconds: defaultSamplingIntervalSeconds,
        lifecycleOwner: "expo-location-background-task",
        continuityMode: "continuous-background",
      });
      try {
        await Location.startLocationUpdatesAsync(androidTripTrackingTaskName, locationUpdatesOptions);
      } catch (error) {
        await backgroundTaskDiagnosticsStore.recordError(error);
        const failedDiagnostics = await this.getDiagnostics(activeTrip);
        return {
          ...failedDiagnostics,
          operationState: "recovering" as const,
          lastRecoveryAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : "Unable to recover Android background tracking.",
        };
      }
      await startForegroundWatch(activeTrip.id);
      const recoveredDiagnostics = await this.getDiagnostics(activeTrip);
      return {
        ...recoveredDiagnostics,
        operationState: "recovering" as const,
        lastRecoveryAt: new Date().toISOString(),
        lastError: activeSession ? recoveredDiagnostics.lastError : "tracking-session-missing-recovered",
      };
    }

    if (activeTrip && activeSession?.sessionId === activeTrip.id && diagnostics.active && !foregroundLocationSubscription) {
      await startForegroundWatch(activeTrip.id);
      const recoveredDiagnostics = await this.getDiagnostics(activeTrip);
      return {
        ...recoveredDiagnostics,
        operationState: "recovering" as const,
        lastRecoveryAt: new Date().toISOString(),
      };
    }

    return {
      ...diagnostics,
      lastRecoveryAt: activeTrip ? new Date().toISOString() : diagnostics.lastRecoveryAt,
    };
  },
  async drainSamples(trip: MobileTripSession): Promise<TrackingDrainResult> {
    const activeSession = await trackingSessionStorage.getActiveSession();
    const mismatch = Boolean(activeSession?.sessionId && activeSession.sessionId !== trip.id);
    if (mismatch) {
      const diagnostics = await this.getDiagnostics(trip);
      return {
        importedCount: 0,
        importedSampleCount: diagnostics.importedSampleCount,
        lastSampleAt: diagnostics.lastSampleAt,
        lastImportAt: diagnostics.lastImportAt,
        diagnostics: {
          ...diagnostics,
          healthState: "session-mismatch",
          sessionMismatch: true,
          actualServiceState: "mismatch",
          stateMatchesExpectation: false,
          lastError: "native-session-mismatch",
        },
      };
    }

    const nativeSamples = await trackingNativeBufferStore.listSamples(trip.id);
    const importResult = await trackingSampleStore.appendSamples(nativeSamples);
    await trackingNativeBufferStore.clearSession(trip.id);
    const importedSamples = await trackingSampleStore.listSamples(trip.id);
    const importedAt = new Date().toISOString();
    const nextMetadata = activeSession
      ? {
          ...activeSession,
          lastDrainAt: importedAt,
          lastImportAt: importedAt,
        }
      : null;
    if (nextMetadata) {
      await trackingSessionStorage.saveActiveSession(nextMetadata);
    }

    const [availability, backgroundTaskSnapshot] = await Promise.all([getAvailability(), backgroundTaskDiagnosticsStore.getSnapshot()]);
    const isTaskActive = await getTaskActive();
    const sourceSummary = getSourceSummary(importedSamples, []);
    const diagnostics = createDiagnostics({
      availability,
      active: isTaskActive,
      expectedServiceState: "running",
      sessionId: trip.id,
      nativeBufferedCount: 0,
      importedSampleCount: importedSamples.length,
      foregroundWatchActive: Boolean(foregroundLocationSubscription),
      ...sourceSummary,
      backgroundTaskDefined: getTaskDefined(),
      backgroundTaskStarted: isTaskActive,
      lastBackgroundTaskCallbackAt: backgroundTaskSnapshot.lastCallbackAt,
      backgroundTaskCallbackCount: backgroundTaskSnapshot.callbackCount,
      lastBackgroundTaskError: backgroundTaskSnapshot.lastError,
      lastBackgroundTaskErrorAt: backgroundTaskSnapshot.lastErrorAt,
      sessionStartedAt: trip.startedAt,
      lastSampleAt: importResult.lastSample?.recordedAt ?? trip.lastSampleAt,
      lastDrainAt: importedAt,
      lastDrainCount: nativeSamples.length,
      lastImportAt: importedAt,
      lastImportCount: importResult.importedCount,
      foregroundPermission: "foregroundPermission" in availability ? availability.foregroundPermission : undefined,
      backgroundPermission: "backgroundPermission" in availability ? availability.backgroundPermission : undefined,
      locationServicesEnabled: "locationServicesEnabled" in availability ? availability.locationServicesEnabled : undefined,
    });

    return {
      importedCount: importResult.importedCount,
      importedSampleCount: importedSamples.length,
      lastSampleAt: importResult.lastSample?.recordedAt ?? trip.lastSampleAt,
      lastImportAt: importedAt,
      diagnostics,
    };
  },
  async stopTracking(trip: MobileTripSession): Promise<TrackingDrainResult> {
    const drainResult = await this.drainSamples(trip);
    await stopForegroundWatch();
    const stoppedAt = new Date().toISOString();
    let stopError: string | undefined;
    if (Platform.OS === "android") {
      const isTaskActive = await getTaskActive();
      if (isTaskActive) {
        try {
          await Location.stopLocationUpdatesAsync(androidTripTrackingTaskName);
        } catch (error) {
          await backgroundTaskDiagnosticsStore.recordError(error);
          if (!isBenignAndroidStopError(error)) {
            stopError = error instanceof Error ? error.message : "Unable to Gig Android background tracking.";
          }
        }
      }
    }
    const stillActive = await getTaskActive();
    const stopVerified = !stillActive && !stopError;
    if (stopVerified) {
      await trackingSessionStorage.clearActiveSession();
    }

    return {
      ...drainResult,
      diagnostics: {
        ...drainResult.diagnostics,
        healthState: stopVerified ? "stopped-cleanly" : "stopped-unexpectedly",
        sampleArrivalState: "not-tracking",
        operationState: "idle",
        active: stillActive,
        expectedServiceState: "stopped",
        actualServiceState: stillActive ? "running" : "stopped",
        stateMatchesExpectation: stopVerified,
        backgroundCallbackState: stillActive ? drainResult.diagnostics.backgroundCallbackState : "not-started",
        backgroundDiagnosis: stillActive ? drainResult.diagnostics.backgroundDiagnosis : "none",
        backgroundDiagnosisMessage: stillActive
          ? drainResult.diagnostics.backgroundDiagnosisMessage
          : "No background tracking issue detected.",
        likelyBackgroundRestricted: stillActive ? drainResult.diagnostics.likelyBackgroundRestricted : false,
        backgroundTaskStarted: stillActive,
        staleServiceDetected: !stopVerified,
        lastStopAt: stoppedAt,
        stopVerified,
        lastError: stopError ?? (stopVerified ? drainResult.diagnostics.lastError : "background-task-still-running-after-Gig"),
        updatedAt: stoppedAt,
      },
    };
  },
};
