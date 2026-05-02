import { afterEach, describe, expect, it } from "vitest";
import {
  clearTripSession,
  readTripSession,
  TRIP_SESSION_EVENT,
  writeTripSession,
  type TripSessionState,
} from "@/features/trips/session-store";
import {
  resetAppPersistenceProviderForTests,
  setAppPersistenceProviderForTests,
  type AppPersistenceProvider,
} from "@/features/mobile/persistence";

function createProviderHarness() {
  const store = new Map<string, string>();
  const events: string[] = [];

  const provider: AppPersistenceProvider = {
    kind: "in-memory",
    isStorageAvailable: () => true,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    emit: (eventName) => {
      events.push(eventName);
    },
    subscribe: () => () => undefined,
    subscribeStorageChanges: () => () => undefined,
  };

  return { provider, events };
}

describe("trip session store", () => {
  afterEach(() => {
    resetAppPersistenceProviderForTests();
  });

  it("persists and reads trip session state through provider abstraction", () => {
    const { provider } = createProviderHarness();
    setAppPersistenceProviderForTests(provider);

    const session: TripSessionState = {
      id: "trip-1",
      workspaceId: "workspace-1",
      startedAt: "2026-04-10T08:00:00.000Z",
      lastSampleAt: "2026-04-10T08:00:15.000Z",
      totalDistanceKm: 2.4,
      samples: [
        {
          latitude: -33.86,
          longitude: 151.2,
          accuracyMeters: 6,
          recordedAt: "2026-04-10T08:00:15.000Z",
        },
      ],
    };

    writeTripSession("workspace-1", session);

    expect(readTripSession("workspace-1")).toEqual(session);
  });

  it("emits update event on write and clear", () => {
    const { provider, events } = createProviderHarness();
    setAppPersistenceProviderForTests(provider);

    const session: TripSessionState = {
      id: "trip-2",
      workspaceId: "workspace-2",
      startedAt: "2026-04-10T09:00:00.000Z",
      lastSampleAt: "2026-04-10T09:00:15.000Z",
      totalDistanceKm: 0,
      samples: [],
    };

    writeTripSession("workspace-2", session);
    clearTripSession("workspace-2");

    expect(events).toEqual([TRIP_SESSION_EVENT, TRIP_SESSION_EVENT]);
    expect(readTripSession("workspace-2")).toBeNull();
  });
});
