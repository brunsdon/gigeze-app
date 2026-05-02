import { afterEach, describe, expect, it } from "vitest";
import { detectMobileRuntime } from "@/features/mobile/runtime";
import { detectMobileRuntimeCapabilities } from "@/features/mobile/capabilities";

function clearBrowserGlobals() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined,
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: undefined,
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: undefined,
  });
}

describe("mobile runtime", () => {
  afterEach(() => {
    clearBrowserGlobals();
  });

  it("reports non-browser runtime when browser globals are unavailable", () => {
    clearBrowserGlobals();

    const runtime = detectMobileRuntime();

    expect(runtime.mode).toBe("non-browser");
    expect(runtime.isNativeShell).toBe(false);
    expect(runtime.isBrowser).toBe(false);
    expect(runtime.platform).toBe("server");
  });

  it("reports web runtime when browser globals exist", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    const runtime = detectMobileRuntime();

    expect(runtime.mode).toBe("web");
    expect(runtime.isNativeShell).toBe(false);
    expect(runtime.isBrowser).toBe(true);
    expect(runtime.platform).toBe("web");
  });

  it("reports conservative capability defaults in non-browser tests", () => {
    clearBrowserGlobals();

    const capabilities = detectMobileRuntimeCapabilities();

    expect(capabilities.geolocationSupported).toBe(false);
    expect(capabilities.persistentStorageAvailable).toBe(false);
    expect(capabilities.wakeLockSupported).toBe(false);
    expect(capabilities.backgroundLocationSupported).toBe(false);
    expect(capabilities.durableDeviceStorageSupported).toBe(false);
    expect(capabilities.appLifecycleEventsSupported).toBe(false);
  });

  it("recognizes browser APIs when browser globals exist", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {},
        addEventListener: () => undefined,
      },
    });

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        addEventListener: () => undefined,
      },
    });

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        geolocation: {},
        onLine: true,
        wakeLock: {},
      },
    });

    const capabilities = detectMobileRuntimeCapabilities();

    expect(capabilities.geolocationSupported).toBe(true);
    expect(capabilities.persistentStorageAvailable).toBe(true);
    expect(capabilities.wakeLockSupported).toBe(true);
    expect(capabilities.appLifecycleEventsSupported).toBe(true);
    expect(capabilities.backgroundLocationSupported).toBe(false);
  });
});
