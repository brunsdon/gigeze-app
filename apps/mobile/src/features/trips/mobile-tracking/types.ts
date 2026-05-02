export type TrackingSampleSource = "expo-background-location" | "expo-foreground-location";

export type TrackingSampleRecord = {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestampMs: number;
  recordedAt: string;
  source: TrackingSampleSource;
  originId: string;
  sequence: number;
};

export type TrackingAvailability =
  | { status: "available" }
  | {
      status: "unavailable";
      reason:
        | "not-android"
        | "unsupported-runtime"
        | "task-manager-unavailable"
        | "permission-denied"
        | "background-permission-denied"
        | "background-task-not-defined"
        | "location-services-disabled"
        | "unknown";
    };

export type TrackingLifecycleOwner = "expo-location-background-task" | "unsupported";

export type TrackingContinuityMode = "continuous-background" | "unsupported";

export type TrackingRuntimeMode = "expo-go" | "development-build" | "standalone" | "unknown";

export type TrackingHealthState =
  | "unavailable"
  | "unsupported-runtime"
  | "permission-missing"
  | "provider-disabled"
  | "active-healthy"
  | "active-foreground-only"
  | "active-background-not-firing"
  | "active-background-task-error"
  | "active-stale"
  | "active-no-samples"
  | "session-mismatch"
  | "stopped-cleanly"
  | "stopped-unexpectedly";

export type TrackingSampleArrivalState = "not-tracking" | "waiting-for-first-sample" | "fresh" | "stale" | "unknown";

export type TrackingOperationState = "idle" | "recovering" | "stopping";

export type TrackingBackgroundCallbackState =
  | "unsupported"
  | "not-started"
  | "waiting-for-callback"
  | "recent-callback"
  | "stale-callback";

export type TrackingBackgroundDiagnosis =
  | "none"
  | "unsupported-runtime"
  | "permission-missing"
  | "provider-disabled"
  | "task-not-defined"
  | "task-not-started"
  | "waiting-for-callback"
  | "stale-callback"
  | "callback-error"
  | "likely-os-background-restriction"
  | "foreground-only";

export type TrackingDiagnostics = {
  platform: string;
  runtimeMode: TrackingRuntimeMode;
  supportsBackgroundTracking: boolean;
  availability: TrackingAvailability;
  healthState: TrackingHealthState;
  sampleArrivalState: TrackingSampleArrivalState;
  operationState: TrackingOperationState;
  backgroundCallbackState: TrackingBackgroundCallbackState;
  backgroundDiagnosis: TrackingBackgroundDiagnosis;
  backgroundDiagnosisMessage: string;
  likelyBackgroundRestricted: boolean;
  active: boolean;
  expectedServiceState: "running" | "stopped";
  actualServiceState: "running" | "stopped" | "unknown" | "mismatch";
  stateMatchesExpectation: boolean;
  lifecycleOwner: TrackingLifecycleOwner;
  continuityMode: TrackingContinuityMode;
  sessionId?: string;
  nativeBufferedCount: number;
  importedSampleCount: number;
  foregroundWatchActive: boolean;
  foregroundSampleCount: number;
  backgroundSampleCount: number;
  lastForegroundSampleAt: string | null;
  lastBackgroundSampleAt: string | null;
  backgroundTaskDefined: boolean;
  backgroundTaskStarted: boolean;
  lastBackgroundTaskCallbackAt: string | null;
  backgroundTaskCallbackCount: number;
  lastBackgroundTaskError: string | null;
  lastBackgroundTaskErrorAt: string | null;
  lastSampleAt?: string;
  lastDrainAt?: string;
  lastDrainCount: number;
  lastImportAt?: string;
  lastImportCount: number;
  secondsSinceLastSample?: number;
  staleThresholdSeconds: number;
  foregroundPermission?: string;
  backgroundPermission?: string;
  locationServicesEnabled?: boolean;
  staleServiceDetected: boolean;
  sessionMismatch: boolean;
  lastRecoveryAt?: string;
  lastStopAt?: string;
  stopVerified?: boolean;
  lastError?: string;
  updatedAt: string;
};

export type TrackingDrainResult = {
  importedCount: number;
  importedSampleCount: number;
  lastSampleAt?: string;
  lastImportAt?: string;
  diagnostics: TrackingDiagnostics;
};
