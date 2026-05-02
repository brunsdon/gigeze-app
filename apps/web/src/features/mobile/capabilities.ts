import { detectMobileRuntime, type MobileRuntime } from "@/features/mobile/runtime";

export type MobileRuntimeCapabilities = {
  runtime: MobileRuntime;
  geolocationSupported: boolean;
  persistentStorageAvailable: boolean;
  wakeLockSupported: boolean;
  visibilityEventsSupported: boolean;
  networkStatusApiSupported: boolean;
  backgroundLocationSupported: boolean;
  durableDeviceStorageSupported: boolean;
  appLifecycleEventsSupported: boolean;
  nativePermissionOrchestrationSupported: boolean;
};

export function detectMobileRuntimeCapabilities(runtime: MobileRuntime = detectMobileRuntime()): MobileRuntimeCapabilities {
  const hasNavigator = typeof navigator !== "undefined";
  const hasDocument = typeof document !== "undefined";
  const hasWindow = typeof window !== "undefined";

  return {
    runtime,
    geolocationSupported: hasNavigator && "geolocation" in navigator,
    persistentStorageAvailable: hasWindow && typeof window.localStorage !== "undefined",
    wakeLockSupported: hasNavigator && "wakeLock" in navigator,
    visibilityEventsSupported: hasDocument && typeof document.addEventListener === "function",
    networkStatusApiSupported: hasNavigator && typeof navigator.onLine === "boolean",
    backgroundLocationSupported: false,
    durableDeviceStorageSupported: hasWindow && typeof window.localStorage !== "undefined",
    appLifecycleEventsSupported:
      (hasDocument && typeof document.addEventListener === "function")
      || (hasWindow && typeof window.addEventListener === "function"),
    // TODO(native): detect centralized permission orchestration APIs.
    nativePermissionOrchestrationSupported: false,
  };
}
