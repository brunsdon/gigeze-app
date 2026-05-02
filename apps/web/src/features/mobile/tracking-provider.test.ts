import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTripTrackingProvider,
  resetTripTrackingProviderForTests,
} from "@/features/mobile/tracking-provider";
import { resetAppPersistenceProviderForTests } from "@/features/mobile/persistence";

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

function installBrowserTrackingHarness() {
  const store = new Map<string, string>();
  const events = new EventTarget();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    },
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: -33.86,
              longitude: 151.2,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: 1234,
            toJSON: () => ({}),
          });
        }),
      },
      permissions: {
        query: vi.fn(async () => ({ state: "granted" })),
      },
    },
  });
}

describe("trip tracking provider", () => {
  afterEach(() => {
    resetTripTrackingProviderForTests();
    resetAppPersistenceProviderForTests();
    clearBrowserGlobals();
  });

  it("uses a browser provider when geolocation is available", async () => {
    installBrowserTrackingHarness();

    const provider = getTripTrackingProvider();

    expect(provider.kind).toBe("browser");
    expect(await provider.getAvailability()).toEqual({ status: "available" });
    expect(await provider.getPermissionState()).toBe("granted");

    const sample = await provider.sampleCurrentPosition();
    expect(sample.position).toMatchObject({
      latitude: -33.86,
      longitude: 151.2,
      accuracyMeters: 12,
      timestampMs: 1234,
    });
  });

  it("persists and recovers an active foreground session", async () => {
    installBrowserTrackingHarness();
    const provider = getTripTrackingProvider();

    const started = await provider.startTrackingSession({
      sessionId: "trip-1",
      workspaceId: "workspace-1",
      startedAt: "2026-04-17T00:00:00.000Z",
      samplingIntervalSeconds: 15,
    });

    expect(started.state).toBe("active");
    expect(started.session?.continuityMode).toBe("sample-on-demand");

    const recovered = await provider.recoverActiveSession();
    expect(recovered.status).toBe("recovered");
    expect(recovered.sessionStatus?.session?.sessionId).toBe("trip-1");

    const stopped = await provider.stopTrackingSession();
    expect(stopped.state).toBe("idle");
  });

  it("uses a fallback provider when browser location APIs are unavailable", async () => {
    clearBrowserGlobals();

    const provider = getTripTrackingProvider();

    expect(provider.kind).toBe("fallback");
    expect(await provider.getAvailability()).toEqual({ status: "unavailable", reason: "unsupported" });
    expect(await provider.sampleCurrentPosition()).toEqual({ position: null, errorCode: "unsupported" });
  });
});
