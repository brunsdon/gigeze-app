import { afterEach, describe, expect, it } from "vitest";
import {
  getAppPersistenceProvider,
  resetAppPersistenceProviderForTests,
} from "@/features/mobile/persistence";

function clearBrowserGlobals() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined,
  });
}

describe("app persistence provider", () => {
  afterEach(() => {
    resetAppPersistenceProviderForTests();
    clearBrowserGlobals();
  });

  it("falls back to in-memory storage when localStorage is unavailable", () => {
    clearBrowserGlobals();

    const provider = getAppPersistenceProvider();
    provider.setItem("k", "v");

    expect(provider.kind).toBe("in-memory");
    expect(provider.getItem("k")).toBe("v");
  });

  it("uses browser localStorage provider when localStorage is available", () => {
    const store = new Map<string, string>();
    const events = new EventTarget();

    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage,
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
      },
    });

    const provider = getAppPersistenceProvider();
    provider.setItem("key", "value");

    expect(provider.kind).toBe("browser-local-storage");
    expect(provider.getItem("key")).toBe("value");

    provider.removeItem("key");
    expect(provider.getItem("key")).toBeNull();
  });
});
