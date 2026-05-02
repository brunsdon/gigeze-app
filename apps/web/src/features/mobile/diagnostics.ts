import { detectMobileRuntimeCapabilities, type MobileRuntimeCapabilities } from "@/features/mobile/capabilities";
import type { MobileRuntimeMode } from "@/features/mobile/runtime";
import type { AppLifecycleProviderKind } from "@/features/mobile/lifecycle-provider";
import type { AppPersistenceProviderKind } from "@/features/mobile/persistence";
import type { SyncTriggerProviderKind, SyncTriggerSource } from "@/features/mobile/sync-trigger";
import type {
  TripTrackingAvailability,
  TripTrackingBackgroundReadiness,
  TripTrackingPermissionState,
  TripTrackingProviderKind,
} from "@/features/mobile/tracking-provider";

export type MobileDiagnosticsSnapshot = {
  runtimeMode?: MobileRuntimeMode;
  capabilities?: MobileRuntimeCapabilities;
  trackingProviderKind?: TripTrackingProviderKind;
  persistenceProviderKind?: AppPersistenceProviderKind;
  lifecycleProviderKind?: AppLifecycleProviderKind;
  syncTriggerProviderKind?: SyncTriggerProviderKind;
  lastSyncTriggerSource?: SyncTriggerSource;
  trackingAvailability?: TripTrackingAvailability;
  trackingBackgroundReadiness?: TripTrackingBackgroundReadiness;
  trackingPermissionState?: TripTrackingPermissionState;
  trackingSamplingPath?: "browser" | "fallback";
};

type MobileDiagnosticsListener = (snapshot: MobileDiagnosticsSnapshot) => void;

const listeners = new Set<MobileDiagnosticsListener>();

let snapshot: MobileDiagnosticsSnapshot = {};

function isDiagnosticsEnabled() {
  return process.env.NODE_ENV !== "production";
}

function cloneSnapshot() {
  return { ...snapshot };
}

export function getMobileDiagnosticsSnapshot() {
  return cloneSnapshot();
}

export function subscribeMobileDiagnostics(listener: MobileDiagnosticsListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function updateMobileDiagnostics(partial: MobileDiagnosticsSnapshot) {
  snapshot = {
    ...snapshot,
    ...partial,
  };

  if (isDiagnosticsEnabled() && typeof console !== "undefined") {
    console.debug("[gigeze/mobile]", partial);
  }

  for (const listener of listeners) {
    listener(cloneSnapshot());
  }
}

export function refreshMobileDiagnosticsSnapshot() {
  const capabilities = detectMobileRuntimeCapabilities();

  updateMobileDiagnostics({
    runtimeMode: capabilities.runtime.mode,
    capabilities,
  });

  return cloneSnapshot();
}
