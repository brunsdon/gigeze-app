import { detectMobileRuntimeCapabilities, type MobileRuntimeCapabilities } from "@/features/mobile/capabilities";
import { updateMobileDiagnostics } from "@/features/mobile/diagnostics";

export type AppLifecycleVisibility = "active" | "background";

export type AppLifecycleProviderKind = "browser" | "fallback";

export type AppLifecycleEventType = "active" | "background" | "resumed" | "connectivity-restored";

export type AppLifecycleSnapshot = {
  visibility: AppLifecycleVisibility;
  isOnline: boolean;
  runtimeCapabilities: MobileRuntimeCapabilities;
};

export type AppLifecycleEvent = {
  type: AppLifecycleEventType;
  at: string;
  snapshot: AppLifecycleSnapshot;
};

export type AppLifecycleProvider = {
  kind: AppLifecycleProviderKind;
  getSnapshot: () => AppLifecycleSnapshot;
  subscribe: (listener: (event: AppLifecycleEvent) => void) => () => void;
};

function nowIso() {
  return new Date().toISOString();
}

function getBrowserVisibility(): AppLifecycleVisibility {
  if (typeof document === "undefined") {
    return "active";
  }

  return document.visibilityState === "hidden" ? "background" : "active";
}

function getBrowserOnlineState() {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }

  return navigator.onLine;
}

function createBrowserLifecycleProvider(): AppLifecycleProvider {
  let snapshot: AppLifecycleSnapshot = {
    visibility: getBrowserVisibility(),
    isOnline: getBrowserOnlineState(),
    runtimeCapabilities: detectMobileRuntimeCapabilities(),
  };

  const listeners = new Set<(event: AppLifecycleEvent) => void>();

  const emit = (type: AppLifecycleEventType) => {
    const event: AppLifecycleEvent = {
      type,
      at: nowIso(),
      snapshot,
    };

    for (const listener of listeners) {
      listener(event);
    }
  };

  const handleVisibilityChange = () => {
    const previousVisibility = snapshot.visibility;
    snapshot = {
      visibility: getBrowserVisibility(),
      isOnline: getBrowserOnlineState(),
      runtimeCapabilities: detectMobileRuntimeCapabilities(),
    };

    if (snapshot.visibility === "background") {
      emit("background");
      return;
    }

    emit("active");
    if (previousVisibility === "background") {
      emit("resumed");
    }
  };

  const handleConnectivityChange = () => {
    const wasOnline = snapshot.isOnline;
    snapshot = {
      visibility: getBrowserVisibility(),
      isOnline: getBrowserOnlineState(),
      runtimeCapabilities: detectMobileRuntimeCapabilities(),
    };

    if (!wasOnline && snapshot.isOnline) {
      emit("connectivity-restored");
    }
  };

  const subscribeBrowserEvents = () => {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleConnectivityChange);
      window.addEventListener("offline", handleConnectivityChange);
    }
  };

  const unsubscribeBrowserEvents = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleConnectivityChange);
      window.removeEventListener("offline", handleConnectivityChange);
    }
  };

  return {
    kind: "browser",
    getSnapshot: () => ({
      ...snapshot,
      runtimeCapabilities: detectMobileRuntimeCapabilities(),
    }),
    subscribe: (listener) => {
      listeners.add(listener);

      if (listeners.size === 1) {
        subscribeBrowserEvents();
      }

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          unsubscribeBrowserEvents();
        }
      };
    },
  };
}

function createFallbackLifecycleProvider(): AppLifecycleProvider {
  const snapshot: AppLifecycleSnapshot = {
    visibility: "active",
    isOnline: true,
    runtimeCapabilities: detectMobileRuntimeCapabilities(),
  };

  return {
    kind: "fallback",
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
  };
}

let appLifecycleProviderOverride: AppLifecycleProvider | null = null;
let appLifecycleProviderSingleton: AppLifecycleProvider | null = null;

function createDefaultLifecycleProvider() {
  const capabilities = detectMobileRuntimeCapabilities();
  updateMobileDiagnostics({
    runtimeMode: capabilities.runtime.mode,
    capabilities,
  });

  if (capabilities.visibilityEventsSupported || capabilities.networkStatusApiSupported) {
    return createBrowserLifecycleProvider();
  }

  return createFallbackLifecycleProvider();
}

export function getAppLifecycleProvider(): AppLifecycleProvider {
  if (appLifecycleProviderOverride) {
    return appLifecycleProviderOverride;
  }

  if (!appLifecycleProviderSingleton) {
    appLifecycleProviderSingleton = createDefaultLifecycleProvider();
    updateMobileDiagnostics({
      lifecycleProviderKind: appLifecycleProviderSingleton.kind,
    });
  }

  return appLifecycleProviderSingleton;
}

export function setAppLifecycleProviderForTests(provider: AppLifecycleProvider | null) {
  appLifecycleProviderOverride = provider;
}

export function resetAppLifecycleProviderForTests() {
  appLifecycleProviderOverride = null;
  appLifecycleProviderSingleton = null;
}
