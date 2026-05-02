import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileTripSession } from "./trip-workflow";

const storage = new Map<string, string>();

vi.mock("../../lib/storage/mobile-storage", () => ({
  mobileStorage: {
    async getItem(key: string) {
      return storage.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      storage.set(key, value);
    },
    async removeItem(key: string) {
      storage.delete(key);
    },
  },
}));

function createTrip(id: string, status: "active" | "completed" = "active"): MobileTripSession {
  return {
    id,
    userId: "user-1",
    status,
    tripMode: "DRIVE",
    startedAt: "2026-04-12T00:00:00.000Z",
    endedAt: status === "completed" ? "2026-04-12T00:10:00.000Z" : undefined,
    distanceMeters: 0,
    title: `Trip ${id}`,
    sampleCount: 0,
    captureMode: "tracking",
    syncState: "localOnly",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
  };
}

describe("tripStorage", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("persists active and recent trips independently for a user", async () => {
    const { tripStorage } = await import("./trip-storage");
    const activeTrip = createTrip("active-trip");
    const completedTrip = createTrip("completed-trip", "completed");

    await tripStorage.saveActiveTrip("user-1", activeTrip);
    await tripStorage.saveCompletedTrip("user-1", completedTrip);

    expect(await tripStorage.getActiveTrip("user-1")).toMatchObject({ id: "active-trip", status: "active" });
    expect(await tripStorage.listRecentTrips("user-1")).toMatchObject([
      { ...completedTrip, syncState: "pendingSync" },
    ]);
  });

  it("clears only the active trip when completing local workflow", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveActiveTrip("user-1", createTrip("active-trip"));
    await tripStorage.saveCompletedTrip("user-1", createTrip("completed-trip", "completed"));

    await tripStorage.clearActiveTrip("user-1");

    expect(await tripStorage.getActiveTrip("user-1")).toBeNull();
    expect(await tripStorage.listRecentTrips("user-1")).toHaveLength(1);
  });

  it("discovers pending, failed, and interrupted syncing trips for retry", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", { ...createTrip("synced-trip", "completed"), syncState: "synced" });
    await tripStorage.saveCompletedTrip("user-1", { ...createTrip("pending-trip", "completed"), syncState: "pendingSync" });
    await tripStorage.saveCompletedTrip("user-1", { ...createTrip("failed-trip", "completed"), syncState: "syncFailed" });
    await tripStorage.saveCompletedTrip("user-1", { ...createTrip("syncing-trip", "completed"), syncState: "syncing" });

    const pendingTrips = await tripStorage.listPendingSyncTrips("user-1");

    expect(pendingTrips.map((trip) => trip.id)).toEqual(["syncing-trip", "failed-trip", "pending-trip"]);
  });

  it("recovers older completed local-only trips into pending sync", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", { ...createTrip("old-local-trip", "completed"), syncState: "localOnly" });

    const recentTrips = await tripStorage.listRecentTrips("user-1");
    const pendingTrips = await tripStorage.listPendingSyncTrips("user-1");

    expect(recentTrips).toMatchObject([{ id: "old-local-trip", syncState: "pendingSync" }]);
    expect(pendingTrips).toMatchObject([{ id: "old-local-trip", syncState: "pendingSync" }]);
  });

  it("treats older completed trips with backend metadata as synced", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("old-synced-trip", "completed"),
      syncState: "localOnly",
      backendTripId: "log-1",
    });

    expect(await tripStorage.listRecentTrips("user-1")).toMatchObject([{ id: "old-synced-trip", syncState: "synced" }]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toHaveLength(0);
  });

  it("updates completed trip sync metadata without dropping local history", async () => {
    const { tripStorage } = await import("./trip-storage");
    const completedTrip = createTrip("completed-trip", "completed");
    await tripStorage.saveCompletedTrip("user-1", completedTrip);

    const storedTrips = await tripStorage.updateCompletedTrip("user-1", {
      ...completedTrip,
      syncState: "synced",
      backendTripId: "log-1",
      lastSyncSucceededAt: "2026-04-12T00:11:00.000Z",
    });
    const snapshot = await tripStorage.getSnapshot("user-1");

    expect(storedTrips).toMatchObject([{ id: "completed-trip", syncState: "synced", backendTripId: "log-1" }]);
    expect(snapshot.syncDiagnostics.syncedCount).toBe(1);
  });

  it("updates completed trip editable metadata and marks it for sync", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
      tripPurpose: "PRIVATE",
      vehicleId: "vehicle-1",
      vehicleName: "Old Van",
    });

    const visibleTrips = await tripStorage.updateCompletedTripMetadata("user-1", "synced-trip", {
      tripPurpose: "BUSINESS",
      vehicleId: "vehicle-2",
      vehicleName: "Work Van",
      startOdometer: 12345,
      endOdometer: 12352,
    }, "2026-04-12T00:12:00.000Z");

    expect(visibleTrips).toMatchObject([{
      id: "synced-trip",
      syncState: "pendingSync",
      tripPurpose: "BUSINESS",
      vehicleId: "vehicle-2",
      vehicleName: "Work Van",
      startOdometer: 12345,
      endOdometer: 12352,
      lastSyncError: undefined,
      updatedAt: "2026-04-12T00:12:00.000Z",
    }]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([{ id: "synced-trip", syncState: "pendingSync" }]);
  });

  it("stores and refreshes trip mode from backend summaries", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("walk-trip", "completed"),
      tripMode: "DRIVE",
      syncState: "synced",
      backendTripId: "log-walk-1",
    });

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-walk-1",
        tripMode: "WALK",
        backendDistanceKm: 0.6,
        updatedAt: "2026-04-21T08:00:00.000Z",
      },
    ]);

    expect(visibleTrips).toMatchObject([{ id: "walk-trip", tripMode: "WALK", backendDistanceKm: 0.6 }]);
  });

  it("does not apply metadata edits to deleted trips", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("deleted-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
      tripPurpose: "PRIVATE",
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "deleted",
    });

    const visibleTrips = await tripStorage.updateCompletedTripMetadata("user-1", "deleted-trip", {
      tripPurpose: "BUSINESS",
      vehicleId: "vehicle-2",
      vehicleName: "Work Van",
    }, "2026-04-20T01:01:00.000Z");

    expect(visibleTrips).toEqual([]);
    expect(await tripStorage.listStoredTrips("user-1")).toMatchObject([{
      id: "deleted-trip",
      tripPurpose: "PRIVATE",
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "deleted",
    }]);
  });

  it("hides mobile-deleted trips immediately while preserving a tombstone for sync", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
    });

    const visibleTrips = await tripStorage.deleteCompletedTrip("user-1", "synced-trip", "2026-04-20T01:00:00.000Z");

    expect(visibleTrips).toEqual([]);
    expect(await tripStorage.listRecentTrips("user-1")).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([
      {
        id: "synced-trip",
        backendTripId: "log-1",
        deletedAt: "2026-04-20T01:00:00.000Z",
        deletionSyncState: "pendingDelete",
      },
    ]);
  });

  it("stages delete for undo without adding it to the sync queue", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
    });

    const visibleTrips = await tripStorage.stageCompletedTripDelete(
      "user-1",
      "synced-trip",
      "2026-04-20T01:00:07.000Z",
      "2026-04-20T01:00:00.000Z",
    );

    expect(visibleTrips).toEqual([]);
    expect(await tripStorage.listRecentTrips("user-1")).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toEqual([]);
    expect(await tripStorage.getPendingUndoDelete("user-1")).toEqual({
      tripId: "synced-trip",
      title: "Trip synced-trip",
      message: "Trip deleted · 12 Apr",
      undoExpiresAt: "2026-04-20T01:00:07.000Z",
    });
  });

  it("formats pending undo message with date and distance when available", async () => {
    const { formatDeletedTripSummary } = await import("./trip-storage");

    expect(formatDeletedTripSummary({
      ...createTrip("distance-trip", "completed"),
      startedAt: "2026-04-14T08:00:00.000Z",
      distanceMeters: 9200,
    })).toBe("Trip deleted · 14 Apr · 9.2 km");
  });

  it("formats pending undo message with date and vehicle when distance is missing", async () => {
    const { formatDeletedTripSummary } = await import("./trip-storage");

    expect(formatDeletedTripSummary({
      ...createTrip("vehicle-trip", "completed"),
      startedAt: "2026-04-14T08:00:00.000Z",
      distanceMeters: 0,
      vehicleName: "Camper Van",
    })).toBe("Trip deleted · 14 Apr · Camper Van");
  });

  it("keeps pending undo message compact and safe for missing fields", async () => {
    const { formatDeletedTripSummary } = await import("./trip-storage");

    expect(formatDeletedTripSummary({
      ...createTrip("fallback-trip", "completed"),
      startedAt: "not-a-date",
      distanceMeters: 0,
      vehicleName: "Very Long Camper Van Name With Extra Field Notes",
    })).toBe("Trip deleted");
    expect(formatDeletedTripSummary({
      ...createTrip("long-vehicle-trip", "completed"),
      startedAt: "2026-04-14T08:00:00.000Z",
      distanceMeters: 0,
      vehicleName: "Very Long Camper Van Name With Extra Field Notes",
    })).toBe("Trip deleted · 14 Apr · Very Long Camper Van Na…");
  });

  it("undoes a staged delete before the undo window expires", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
    });
    await tripStorage.stageCompletedTripDelete("user-1", "synced-trip", "2026-04-20T01:00:07.000Z", "2026-04-20T01:00:00.000Z");

    const visibleTrips = await tripStorage.undoCompletedTripDelete("user-1", "synced-trip", "2026-04-20T01:00:03.000Z");

    expect(visibleTrips).toMatchObject([{ id: "synced-trip", deletedAt: undefined, deletionSyncState: "notDeleted" }]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toEqual([]);
  });

  it("finalizes an expired staged delete into the normal delete sync queue", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
    });
    await tripStorage.stageCompletedTripDelete("user-1", "synced-trip", "2026-04-20T01:00:07.000Z", "2026-04-20T01:00:00.000Z");

    const visibleTrips = await tripStorage.finalizeCompletedTripDelete("user-1", "synced-trip", "2026-04-20T01:00:08.000Z");

    expect(visibleTrips).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([
      {
        id: "synced-trip",
        backendTripId: "log-1",
        deletedAt: "2026-04-20T01:00:00.000Z",
        deletionSyncState: "pendingDelete",
      },
    ]);
  });

  it("finalizes expired pending undo deletes during restart recovery", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
    });
    await tripStorage.stageCompletedTripDelete("user-1", "synced-trip", "2026-04-20T01:00:07.000Z", "2026-04-20T01:00:00.000Z");

    await tripStorage.recoverInterruptedSyncTrips("user-1", "2026-04-20T01:00:08.000Z");

    expect(await tripStorage.getPendingUndoDelete("user-1")).toBeNull();
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([{ id: "synced-trip", deletionSyncState: "pendingDelete" }]);
  });

  it("keeps confirmed deleted trips hidden across restart", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("deleted-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "deleted",
    });

    expect(await tripStorage.listRecentTrips("user-1")).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toEqual([]);
  });

  it("applies backend tombstones to locally stored synced trips", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
    });

    const visibleTrips = await tripStorage.applyRemoteDeletedTrips("user-1", [
      { backendTripId: "log-1", deletedAt: "2026-04-20T01:00:00.000Z" },
    ]);

    expect(visibleTrips).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toEqual([]);
  });

  it("applies backend trip edits to already-synced local trips", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
      vehicleId: "vehicle-1",
      vehicleName: "Old Van",
      tripPurpose: "PRIVATE",
      backendDistanceKm: 0,
    });

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-1",
        vehicleId: "vehicle-2",
        vehicleName: "VW Caddy",
        tripPurpose: "BUSINESS",
        startedAt: "2026-04-20T20:43:00.000Z",
        endedAt: "2026-04-20T20:45:00.000Z",
        startOdometer: 83807,
        endOdometer: 83810,
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        backendDistanceKm: 3,
        updatedAt: "2026-04-21T08:00:00.000Z",
      },
    ]);

    expect(visibleTrips).toMatchObject([
      {
        id: "synced-trip",
        backendTripId: "log-1",
        vehicleId: "vehicle-2",
        vehicleName: "VW Caddy",
        tripPurpose: "BUSINESS",
        startedAt: "2026-04-20T20:43:00.000Z",
        endedAt: "2026-04-20T20:45:00.000Z",
        startOdometer: 83807,
        endOdometer: 83810,
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        backendDistanceKm: 3,
        syncState: "synced",
        lastSyncSucceededAt: "2026-04-21T08:00:00.000Z",
      },
    ]);
  });

  it("imports backend-created trips that are not already stored locally", async () => {
    const { tripStorage } = await import("./trip-storage");

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-web-1",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        tripPurpose: "BUSINESS",
        startedAt: "2026-04-21T06:43:00.000Z",
        endedAt: "2026-04-21T06:45:00.000Z",
        startOdometer: 83807,
        endOdometer: 83810,
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        backendDistanceKm: 3,
        updatedAt: "2026-04-21T07:00:00.000Z",
      },
    ]);

    expect(visibleTrips).toMatchObject([
      {
        id: "backend-log-web-1",
        userId: "user-1",
        status: "completed",
        backendTripId: "log-web-1",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        tripPurpose: "BUSINESS",
        startedAt: "2026-04-21T06:43:00.000Z",
        endedAt: "2026-04-21T06:45:00.000Z",
        startOdometer: 83807,
        endOdometer: 83810,
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        distanceMeters: 3000,
        backendDistanceKm: 3,
        syncState: "synced",
        lastSyncSucceededAt: "2026-04-21T07:00:00.000Z",
      },
    ]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toEqual([]);
  });

  it("links matching backend summaries to local trips that missed the original sync response", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("local-walk-trip", "completed"),
      tripMode: "WALK",
      syncState: "syncFailed",
      startedAt: "2026-04-26T02:36:00.000Z",
      endedAt: "2026-04-26T03:20:00.000Z",
      distanceMeters: 7000,
      sampleCount: 42,
    });

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-walk-1",
        tripMode: "WALK",
        tripPurpose: "PRIVATE",
        startedAt: "2026-04-26T02:36:20.000Z",
        endedAt: "2026-04-26T03:19:30.000Z",
        backendDistanceKm: 7,
        updatedAt: "2026-04-26T03:21:00.000Z",
      },
    ]);

    expect(visibleTrips).toHaveLength(1);
    expect(visibleTrips).toMatchObject([
      {
        id: "local-walk-trip",
        backendTripId: "log-walk-1",
        syncState: "synced",
        backendDistanceKm: 7,
        sampleCount: 42,
        lastSyncSucceededAt: "2026-04-26T03:21:00.000Z",
      },
    ]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toEqual([]);
  });

  it("collapses already-imported backend duplicates into the original local trip", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("local-walk-trip", "completed"),
      tripMode: "WALK",
      syncState: "syncFailed",
      startedAt: "2026-04-26T02:36:00.000Z",
      endedAt: "2026-04-26T03:20:00.000Z",
      distanceMeters: 7000,
      sampleCount: 42,
    });
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("backend-log-walk-1", "completed"),
      tripMode: "WALK",
      syncState: "synced",
      backendTripId: "log-walk-1",
      startedAt: "2026-04-26T02:36:20.000Z",
      endedAt: "2026-04-26T03:19:30.000Z",
      distanceMeters: 7000,
      backendDistanceKm: 7,
      sampleCount: 0,
    });

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-walk-1",
        tripMode: "WALK",
        startedAt: "2026-04-26T02:36:20.000Z",
        endedAt: "2026-04-26T03:19:30.000Z",
        backendDistanceKm: 7,
        updatedAt: "2026-04-26T03:21:00.000Z",
      },
    ]);

    expect(visibleTrips).toHaveLength(1);
    expect(visibleTrips).toMatchObject([
      {
        id: "local-walk-trip",
        backendTripId: "log-walk-1",
        sampleCount: 42,
        syncState: "synced",
      },
    ]);
  });

  it("keeps distinct backend trips when time or distance do not match local history", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("local-trip", "completed"),
      syncState: "syncFailed",
      startedAt: "2026-04-26T02:36:00.000Z",
      endedAt: "2026-04-26T03:20:00.000Z",
      distanceMeters: 7000,
    });

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-other",
        tripMode: "DRIVE",
        startedAt: "2026-04-26T05:36:00.000Z",
        endedAt: "2026-04-26T06:20:00.000Z",
        backendDistanceKm: 20,
        updatedAt: "2026-04-26T06:21:00.000Z",
      },
    ]);

    expect(visibleTrips.map((trip) => trip.id)).toEqual(["backend-log-other", "local-trip"]);
  });

  it("imports web-created trips using the backend date when times are absent", async () => {
    const { tripStorage } = await import("./trip-storage");

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      {
        backendTripId: "log-web-date-only",
        vehicleName: "VW Caddy",
        tripPurpose: "PRIVATE",
        date: "2026-04-21T00:00:00.000Z",
        startOdometer: 83808,
        endOdometer: 83808,
        backendDistanceKm: 0,
        updatedAt: "2026-04-21T08:42:00.000Z",
      },
    ]);

    expect(visibleTrips).toMatchObject([
      {
        id: "backend-log-web-date-only",
        status: "completed",
        backendTripId: "log-web-date-only",
        startedAt: "2026-04-21T00:00:00.000Z",
        endedAt: "2026-04-21T00:00:00.000Z",
        vehicleName: "VW Caddy",
        startOdometer: 83808,
        endOdometer: 83808,
        backendDistanceKm: 0,
        syncState: "synced",
      },
    ]);
  });

  it("does not let backend trip refresh resurrect deleted trips or overwrite pending local edits", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("pending-trip", "completed"),
      syncState: "pendingSync",
      backendTripId: "log-1",
      backendDistanceKm: 1,
    });
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("deleted-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-2",
      deletedAt: "2026-04-21T00:00:00.000Z",
      deletionSyncState: "deleted",
      backendDistanceKm: 2,
    });

    const visibleTrips = await tripStorage.applyRemoteTripSummaries("user-1", [
      { backendTripId: "log-1", backendDistanceKm: 3, updatedAt: "2026-04-21T08:00:00.000Z" },
      { backendTripId: "log-2", backendDistanceKm: 4, updatedAt: "2026-04-21T08:00:00.000Z" },
    ]);

    expect(visibleTrips).toMatchObject([{ id: "pending-trip", backendDistanceKm: 1, syncState: "pendingSync" }]);
    expect(await tripStorage.listStoredTrips("user-1")).toMatchObject([
      { id: "pending-trip", backendDistanceKm: 1 },
      { id: "deleted-trip", backendDistanceKm: 2, deletedAt: "2026-04-21T00:00:00.000Z" },
    ]);
  });

  it("does not let stale trip saves recreate a local tombstone", async () => {
    const { tripStorage } = await import("./trip-storage");
    const staleTrip = {
      ...createTrip("synced-trip", "completed"),
      syncState: "synced" as const,
      backendTripId: "log-1",
    };
    await tripStorage.saveCompletedTrip("user-1", staleTrip);
    await tripStorage.deleteCompletedTrip("user-1", "synced-trip", "2026-04-20T01:00:00.000Z");

    const visibleTrips = await tripStorage.saveCompletedTrip("user-1", staleTrip);

    expect(visibleTrips).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([
      {
        id: "synced-trip",
        backendTripId: "log-1",
        deletedAt: "2026-04-20T01:00:00.000Z",
      },
    ]);
  });

  it("recovers interrupted syncing trips after app restart", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("syncing-trip", "completed"),
      syncState: "syncing",
      lastSyncAttemptAt: "2026-04-12T00:11:00.000Z",
      backendTripId: "log-1",
    });

    const recoveredTrips = await tripStorage.recoverInterruptedSyncTrips("user-1", "2026-04-12T00:12:00.000Z");

    expect(recoveredTrips).toMatchObject([
      {
        id: "syncing-trip",
        syncState: "syncFailed",
        lastSyncAttemptAt: "2026-04-12T00:11:00.000Z",
        lastSyncError: "Sync was interrupted before completion. Retry is available.",
        backendTripId: "log-1",
      },
    ]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([{ id: "syncing-trip", syncState: "syncFailed" }]);
  });

  it("recovers interrupted deleting trips after app restart", async () => {
    const { tripStorage } = await import("./trip-storage");
    await tripStorage.saveCompletedTrip("user-1", {
      ...createTrip("deleting-trip", "completed"),
      syncState: "synced",
      backendTripId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "deleting",
      deletionSyncAttemptAt: "2026-04-20T01:01:00.000Z",
    });

    const recoveredTrips = await tripStorage.recoverInterruptedSyncTrips("user-1", "2026-04-20T01:02:00.000Z");

    expect(recoveredTrips).toEqual([]);
    expect(await tripStorage.listPendingSyncTrips("user-1")).toMatchObject([
      {
        id: "deleting-trip",
        deletionSyncState: "deleteFailed",
        deletionSyncError: "Deletion sync was interrupted before completion. Retry is available.",
      },
    ]);
  });
});
