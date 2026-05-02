import { getAppPersistenceProvider } from "@/features/mobile/persistence";
import { detectMobileRuntimeCapabilities } from "@/features/mobile/capabilities";
import { updateMobileDiagnostics } from "@/features/mobile/diagnostics";
import { createTrackingSampleStore, type TrackingSampleStore } from "@/features/mobile/tracking-sample-store";

export type TripTrackingErrorCode = "permission-denied" | "position-unavailable" | "timeout" | "unsupported" | "unknown";
export type TripTrackingMode = "foreground" | "background-capable";
export type TripTrackingContinuityMode = "sample-on-demand" | "continuous-foreground" | "continuous-background";
export type TripTrackingLifecycleOwner = "react" | "provider" | "native-service";
export type TripTrackingPermissionState = "unknown" | "granted" | "denied";
export type TripTrackingProviderKind = "browser" | "fallback";

export type TripTrackingAvailability = {
  status: "available" | "unavailable";
  reason?: "permission-denied" | "unsupported" | "native-shell-not-configured" | "background-not-implemented" | "unknown";
};

export type TripTrackingSessionState = "idle" | "active";

export type TripTrackingSession = {
  sessionId: string;
  workspaceId: string;
  journeyId?: string;
  journeySlug?: string;
  journeyTitle?: string;
  startedAt: string;
  samplingIntervalSeconds: number;
  mode: TripTrackingMode;
  continuityMode: TripTrackingContinuityMode;
  lifecycleOwner: TripTrackingLifecycleOwner;
};

export type TripTrackingSessionStatus = {
  state: TripTrackingSessionState;
  session: TripTrackingSession | null;
  sampleStoreKind?: TrackingSampleStore["kind"];
};

export type TripTrackingSessionStartInput = {
  sessionId: string;
  workspaceId: string;
  journeyId?: string;
  journeySlug?: string;
  journeyTitle?: string;
  startedAt: string;
  samplingIntervalSeconds: number;
};

export type TripTrackingRecoveryResult = {
  status: "none" | "recovered" | "unavailable";
  reason?: string;
  sessionStatus?: TripTrackingSessionStatus;
};

export type TripTrackingBackgroundReadiness = {
  status: "foreground-only" | "background-capable" | "unsupported";
  lifecycleOwner: TripTrackingLifecycleOwner;
  continuityMode: TripTrackingContinuityMode;
  sampleStoreKind: TrackingSampleStore["kind"];
  notes: string[];
};

export type TripTrackingPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestampMs: number;
};

export type TripTrackingSampleResult = {
  position: TripTrackingPosition | null;
  errorCode?: TripTrackingErrorCode;
};

type WakeLockHandle = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockHandle>;
  };
};

export type TripTrackingProvider = {
  kind: TripTrackingProviderKind;
  getTrackingMode: () => TripTrackingMode;
  getBackgroundReadiness: () => TripTrackingBackgroundReadiness;
  getSampleStore: () => TrackingSampleStore;
  isGeolocationSupported: () => boolean;
  isWakeLockSupported: () => boolean;
  getPermissionState: () => Promise<TripTrackingPermissionState>;
  getAvailability: () => Promise<TripTrackingAvailability>;
  startTrackingSession: (input: TripTrackingSessionStartInput) => Promise<TripTrackingSessionStatus>;
  stopTrackingSession: () => Promise<TripTrackingSessionStatus>;
  getTrackingSessionStatus: () => Promise<TripTrackingSessionStatus>;
  startContinuousTrackingSession: (input: TripTrackingSessionStartInput) => Promise<TripTrackingSessionStatus>;
  stopContinuousTrackingSession: () => Promise<TripTrackingSessionStatus>;
  getContinuousTrackingSessionStatus: () => Promise<TripTrackingSessionStatus>;
  recoverActiveSession: () => Promise<TripTrackingRecoveryResult>;
  sampleCurrentPosition: (options?: PositionOptions) => Promise<TripTrackingSampleResult>;
  requestScreenWakeLock: () => Promise<WakeLockHandle | null>;
};

type PermissionStatusLike = {
  state: "granted" | "denied" | "prompt";
};

type NavigatorWithPermissions = Navigator & {
  permissions?: {
    query: (descriptor: { name: "geolocation" }) => Promise<PermissionStatusLike>;
  };
};

const TRACKING_SESSION_KEY = "gigeze.trip-tracking-provider-session.v1";

function getIdleTrackingSessionStatus(sampleStore: TrackingSampleStore): TripTrackingSessionStatus {
  return {
    state: "idle",
    session: null,
    sampleStoreKind: sampleStore.kind,
  };
}

function readStoredTrackingSession(): TripTrackingSession | null {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return null;
  }

  const raw = persistence.getItem(TRACKING_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TripTrackingSession;
    if (!parsed || typeof parsed.workspaceId !== "string" || typeof parsed.startedAt !== "string") {
      return null;
    }

    return {
      ...parsed,
      continuityMode: parsed.continuityMode ?? "sample-on-demand",
      lifecycleOwner: parsed.lifecycleOwner ?? "react",
    };
  } catch {
    return null;
  }
}

function writeStoredTrackingSession(session: TripTrackingSession | null) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return;
  }

  if (!session) {
    persistence.removeItem(TRACKING_SESSION_KEY);
    return;
  }

  persistence.setItem(TRACKING_SESSION_KEY, JSON.stringify(session));
}

function toTrackingSessionStatus(session: TripTrackingSession | null, sampleStore: TrackingSampleStore): TripTrackingSessionStatus {
  if (!session) {
    return getIdleTrackingSessionStatus(sampleStore);
  }

  return {
    state: "active",
    session,
    sampleStoreKind: sampleStore.kind,
  };
}

function createSessionTrackingHelpers(
  mode: TripTrackingMode,
  sampleStore: TrackingSampleStore,
  options: {
    continuityMode: TripTrackingContinuityMode;
    lifecycleOwner: TripTrackingLifecycleOwner;
  },
) {
  async function startTrackingSession(input: TripTrackingSessionStartInput) {
    await sampleStore.clearSession(input.sessionId);

    const session: TripTrackingSession = {
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      journeyId: input.journeyId,
      journeySlug: input.journeySlug,
      journeyTitle: input.journeyTitle,
      startedAt: input.startedAt,
      samplingIntervalSeconds: input.samplingIntervalSeconds,
      mode,
      continuityMode: options.continuityMode,
      lifecycleOwner: options.lifecycleOwner,
    };

    writeStoredTrackingSession(session);
    return toTrackingSessionStatus(session, sampleStore);
  }

  async function stopTrackingSession() {
    writeStoredTrackingSession(null);
    return getIdleTrackingSessionStatus(sampleStore);
  }

  return {
    startTrackingSession,
    stopTrackingSession,
    getTrackingSessionStatus: async () => toTrackingSessionStatus(readStoredTrackingSession(), sampleStore),
    startContinuousTrackingSession: startTrackingSession,
    stopContinuousTrackingSession: stopTrackingSession,
    getContinuousTrackingSessionStatus: async () => toTrackingSessionStatus(readStoredTrackingSession(), sampleStore),
    recoverActiveSession: async (): Promise<TripTrackingRecoveryResult> => {
      const session = readStoredTrackingSession();
      if (!session) {
        return {
          status: "none",
          sessionStatus: getIdleTrackingSessionStatus(sampleStore),
        };
      }

      return {
        status: "recovered",
        sessionStatus: toTrackingSessionStatus(session, sampleStore),
      };
    },
  };
}

function createBackgroundReadiness(
  status: TripTrackingBackgroundReadiness["status"],
  sampleStore: TrackingSampleStore,
  lifecycleOwner: TripTrackingLifecycleOwner,
  continuityMode: TripTrackingContinuityMode,
  notes: string[],
): TripTrackingBackgroundReadiness {
  return {
    status,
    lifecycleOwner,
    continuityMode,
    sampleStoreKind: sampleStore.kind,
    notes,
  };
}

function toTrackingErrorCode(error: GeolocationPositionError): TripTrackingErrorCode {
  switch (error.code) {
    case 1:
      return "permission-denied";
    case 2:
      return "position-unavailable";
    case 3:
      return "timeout";
    default:
      return "unknown";
  }
}

async function getBrowserPermissionState(): Promise<TripTrackingPermissionState> {
  const navigatorWithPermissions = typeof navigator !== "undefined" ? (navigator as NavigatorWithPermissions) : null;
  const permissions = navigatorWithPermissions?.permissions;

  if (!permissions?.query) {
    return "unknown";
  }

  try {
    const status = await permissions.query({ name: "geolocation" });

    if (status.state === "granted") {
      return "granted";
    }

    if (status.state === "denied") {
      return "denied";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function createBrowserTrackingProvider(): TripTrackingProvider {
  const sampleStore = createTrackingSampleStore();
  const sessionHelpers = createSessionTrackingHelpers("foreground", sampleStore, {
    continuityMode: "sample-on-demand",
    lifecycleOwner: "react",
  });

  return {
    kind: "browser",
    getTrackingMode: () => "foreground",
    getBackgroundReadiness: () => createBackgroundReadiness("foreground-only", sampleStore, "react", "sample-on-demand", [
      "Browser tracking remains React-driven and foreground-only.",
      "Use the Expo mobile app for native background tracking validation.",
    ]),
    getSampleStore: () => sampleStore,
    isGeolocationSupported: () => typeof navigator !== "undefined" && "geolocation" in navigator,
    isWakeLockSupported: () => typeof navigator !== "undefined" && "wakeLock" in navigator,
    getPermissionState: () => getBrowserPermissionState(),
    getAvailability: async () => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return { status: "unavailable", reason: "unsupported" };
      }

      const permissionState = await getBrowserPermissionState();
      if (permissionState === "denied") {
        return { status: "unavailable", reason: "permission-denied" };
      }

      return { status: "available" };
    },
    startTrackingSession: sessionHelpers.startTrackingSession,
    stopTrackingSession: sessionHelpers.stopTrackingSession,
    getTrackingSessionStatus: sessionHelpers.getTrackingSessionStatus,
    startContinuousTrackingSession: sessionHelpers.startContinuousTrackingSession,
    stopContinuousTrackingSession: sessionHelpers.stopContinuousTrackingSession,
    getContinuousTrackingSessionStatus: sessionHelpers.getContinuousTrackingSessionStatus,
    recoverActiveSession: sessionHelpers.recoverActiveSession,
    sampleCurrentPosition: (options = {}) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return Promise.resolve({ position: null, errorCode: "unsupported" });
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              position: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
                timestampMs: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
              },
            });
          },
          (error) => {
            resolve({ position: null, errorCode: toTrackingErrorCode(error) });
          },
          options,
        );
      });
    },
    requestScreenWakeLock: async () => {
      const navigatorWithWakeLock = typeof navigator !== "undefined" ? (navigator as NavigatorWithWakeLock) : null;
      if (!navigatorWithWakeLock?.wakeLock) {
        return null;
      }

      return navigatorWithWakeLock.wakeLock.request("screen");
    },
  };
}

function createFallbackTrackingProvider(): TripTrackingProvider {
  const sampleStore = createTrackingSampleStore();
  const sessionHelpers = createSessionTrackingHelpers("foreground", sampleStore, {
    continuityMode: "sample-on-demand",
    lifecycleOwner: "react",
  });

  return {
    kind: "fallback",
    getTrackingMode: () => "foreground",
    getBackgroundReadiness: () => createBackgroundReadiness("unsupported", sampleStore, "react", "sample-on-demand", [
      "No geolocation provider is available in this runtime.",
    ]),
    getSampleStore: () => sampleStore,
    isGeolocationSupported: () => false,
    isWakeLockSupported: () => false,
    getPermissionState: async () => "unknown",
    getAvailability: async () => ({ status: "unavailable", reason: "unsupported" }),
    startTrackingSession: sessionHelpers.startTrackingSession,
    stopTrackingSession: sessionHelpers.stopTrackingSession,
    getTrackingSessionStatus: sessionHelpers.getTrackingSessionStatus,
    startContinuousTrackingSession: sessionHelpers.startContinuousTrackingSession,
    stopContinuousTrackingSession: sessionHelpers.stopContinuousTrackingSession,
    getContinuousTrackingSessionStatus: sessionHelpers.getContinuousTrackingSessionStatus,
    recoverActiveSession: sessionHelpers.recoverActiveSession,
    sampleCurrentPosition: async () => ({ position: null, errorCode: "unsupported" }),
    requestScreenWakeLock: async () => null,
  };
}

let trackingProviderOverride: TripTrackingProvider | null = null;
let trackingProviderSingleton: TripTrackingProvider | null = null;

function createDefaultTrackingProvider() {
  const capabilities = detectMobileRuntimeCapabilities();

  if (capabilities.geolocationSupported || capabilities.wakeLockSupported || capabilities.visibilityEventsSupported) {
    return createBrowserTrackingProvider();
  }

  return createFallbackTrackingProvider();
}

export function getTripTrackingProvider(): TripTrackingProvider {
  if (trackingProviderOverride) {
    return trackingProviderOverride;
  }

  if (!trackingProviderSingleton) {
    trackingProviderSingleton = createDefaultTrackingProvider();
    updateMobileDiagnostics({
      trackingProviderKind: trackingProviderSingleton.kind,
      trackingBackgroundReadiness: trackingProviderSingleton.getBackgroundReadiness(),
      runtimeMode: detectMobileRuntimeCapabilities().runtime.mode,
      capabilities: detectMobileRuntimeCapabilities(),
    });
  }

  return trackingProviderSingleton;
}

export function setTripTrackingProviderForTests(provider: TripTrackingProvider | null) {
  trackingProviderOverride = provider;
}

export function resetTripTrackingProviderForTests() {
  trackingProviderOverride = null;
  trackingProviderSingleton = null;
}
