import { afterEach, describe, expect, it } from "vitest";
import {
  resetAppLifecycleProviderForTests,
  setAppLifecycleProviderForTests,
  type AppLifecycleEvent,
  type AppLifecycleProvider,
  type AppLifecycleSnapshot,
} from "@/features/mobile/lifecycle-provider";
import { getSyncTriggerProvider, resetSyncTriggerProviderForTests } from "@/features/mobile/sync-trigger";
import { detectMobileRuntimeCapabilities } from "@/features/mobile/capabilities";

function createLifecycleProviderHarness(kind: AppLifecycleProvider["kind"], initialSnapshot?: Partial<AppLifecycleSnapshot>) {
  const listeners = new Set<(event: AppLifecycleEvent) => void>();

  let snapshot: AppLifecycleSnapshot = {
    visibility: "active",
    isOnline: true,
    runtimeCapabilities: detectMobileRuntimeCapabilities(),
    ...initialSnapshot,
  };

  const provider: AppLifecycleProvider = {
    kind,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    provider,
    emit(type: AppLifecycleEvent["type"], nextSnapshot?: Partial<AppLifecycleSnapshot>) {
      snapshot = {
        ...snapshot,
        ...nextSnapshot,
      };

      const event: AppLifecycleEvent = {
        type,
        at: "2026-04-10T00:00:00.000Z",
        snapshot,
      };

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe("sync trigger provider", () => {
  afterEach(() => {
    resetSyncTriggerProviderForTests();
    resetAppLifecycleProviderForTests();
  });

  it("maps browser lifecycle events into sync triggers", () => {
    const harness = createLifecycleProviderHarness("browser");
    setAppLifecycleProviderForTests(harness.provider);

    const provider = getSyncTriggerProvider();
    const events: string[] = [];

    const unsubscribe = provider.subscribe((event) => {
      events.push(event.source);
    });

    harness.emit("background");
    harness.emit("resumed");
    harness.emit("connectivity-restored");
    unsubscribe();

    expect(events).toEqual(["browser-resumed", "browser-connectivity-restored"]);
  });

  it("ignores lifecycle events while offline", () => {
    const harness = createLifecycleProviderHarness("browser", { isOnline: false });
    setAppLifecycleProviderForTests(harness.provider);

    const provider = getSyncTriggerProvider();
    const events: string[] = [];

    const unsubscribe = provider.subscribe((event) => {
      events.push(event.source);
    });

    harness.emit("resumed", { isOnline: false });
    harness.emit("connectivity-restored", { isOnline: true });
    unsubscribe();

    expect(events).toEqual(["browser-connectivity-restored"]);
  });
});
