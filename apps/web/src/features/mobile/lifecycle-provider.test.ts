import { afterEach, describe, expect, it } from "vitest";
import {
  getAppLifecycleProvider,
  resetAppLifecycleProviderForTests,
} from "@/features/mobile/lifecycle-provider";

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

function installBrowserLifecycleHarness(initialOnline: boolean) {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();

  let visibilityState: "visible" | "hidden" = "visible";
  let online = initialOnline;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: windowTarget.addEventListener.bind(windowTarget),
      removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
      dispatchEvent: windowTarget.dispatchEvent.bind(windowTarget),
    },
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener: documentTarget.addEventListener.bind(documentTarget),
      removeEventListener: documentTarget.removeEventListener.bind(documentTarget),
      dispatchEvent: documentTarget.dispatchEvent.bind(documentTarget),
      get visibilityState() {
        return visibilityState;
      },
    },
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      get onLine() {
        return online;
      },
    },
  });

  return {
    setVisibility(next: "visible" | "hidden") {
      visibilityState = next;
      documentTarget.dispatchEvent(new Event("visibilitychange"));
    },
    setOnline(next: boolean) {
      online = next;
      windowTarget.dispatchEvent(new Event(next ? "online" : "offline"));
    },
  };
}

describe("app lifecycle provider", () => {
  afterEach(() => {
    resetAppLifecycleProviderForTests();
    clearBrowserGlobals();
  });

  it("emits browser lifecycle events for background, resume, and connectivity restoration", () => {
    const harness = installBrowserLifecycleHarness(false);
    const provider = getAppLifecycleProvider();
    const events: string[] = [];

    const unsubscribe = provider.subscribe((event) => {
      events.push(event.type);
    });

    harness.setVisibility("hidden");
    harness.setVisibility("visible");
    harness.setOnline(true);
    unsubscribe();

    expect(provider.kind).toBe("browser");
    expect(events).toEqual(["background", "active", "resumed", "connectivity-restored"]);
  });

  it("falls back safely without browser lifecycle APIs", () => {
    clearBrowserGlobals();

    const provider = getAppLifecycleProvider();

    expect(provider.kind).toBe("fallback");
    expect(provider.getSnapshot().visibility).toBe("active");
    expect(() => provider.subscribe(() => undefined)).not.toThrow();
  });
});
