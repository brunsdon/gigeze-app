import { describe, expect, it } from "vitest";
import {
  completeLocalTripSession,
  createLocalTripSession,
  finalizeTripDelete,
  getTripSyncDiagnostics,
  markTripDeleted,
  markTripDeleteSynced,
  markTripSynced,
  markTripSyncFailed,
  markTripSyncing,
  stageTripDelete,
  undoTripDelete,
  type MobileTripSession,
} from "./trip-workflow";

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "active",
    startedAt: "2026-04-12T00:00:00.000Z",
    distanceMeters: 0,
    title: "Trip 12/04/2026",
    sampleCount: 0,
    captureMode: "tracking",
    syncState: "localOnly",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("trip workflow sync metadata", () => {
  it("persists vehicle purpose and odometer into active trip state", () => {
    const response = createLocalTripSession({
      journeyId: "Tour-1",
      journeyTitle: "NSW Coast Run",
      vehicleId: "vehicle-1",
      vehicleName: "Tour Van",
      tripPurpose: "BUSINESS",
      startOdometer: 12345,
      startedAt: "2026-04-12T00:00:00.000Z",
    }, null);

    expect(response.session).toMatchObject({
      journeyId: "Tour-1",
      journeyTitle: "NSW Coast Run",
      tripMode: "DRIVE",
      vehicleId: "vehicle-1",
      vehicleName: "Tour Van",
      tripPurpose: "BUSINESS",
      startOdometer: 12345,
      status: "active",
    });
  });

  it("marks completed trips pending sync while preserving local completion", () => {
    const completedTrip = completeLocalTripSession(createTrip({
      vehicleId: "vehicle-1",
      vehicleName: "Tour Van",
      tripPurpose: "PRIVATE",
      startOdometer: 12345,
    }), "2026-04-12T00:10:00.000Z");

    expect(completedTrip).toMatchObject({
      status: "completed",
      endedAt: "2026-04-12T00:10:00.000Z",
      syncState: "pendingSync",
      vehicleId: "vehicle-1",
      tripPurpose: "PRIVATE",
      startOdometer: 12345,
    });
  });

  it("stores walk trips without a vehicle", () => {
    const response = createLocalTripSession({
      tripMode: "WALK",
      tripPurpose: "PRIVATE",
      startedAt: "2026-04-12T00:00:00.000Z",
    }, null);

    expect(response.session).toMatchObject({
      tripMode: "WALK",
      vehicleId: undefined,
      vehicleName: undefined,
      startOdometer: undefined,
    });
  });

  it("drops stale purpose when a trip starts without a vehicle", () => {
    const response = createLocalTripSession({
      tripMode: "DRIVE",
      tripPurpose: "BUSINESS",
      startedAt: "2026-04-12T00:00:00.000Z",
    }, null);

    expect(response.session).toMatchObject({
      tripMode: "DRIVE",
      vehicleId: undefined,
      tripPurpose: undefined,
      startOdometer: undefined,
      endOdometer: undefined,
    });
  });

  it("summarizes sync state and latest failure metadata", () => {
    const diagnostics = getTripSyncDiagnostics([
      createTrip({ id: "synced", status: "completed", syncState: "synced", lastSyncSucceededAt: "2026-04-12T00:11:00.000Z" }),
      createTrip({
        id: "failed",
        status: "completed",
        syncState: "syncFailed",
        lastSyncAttemptAt: "2026-04-12T00:12:00.000Z",
        lastSyncError: "network down",
      }),
    ]);

    expect(diagnostics).toMatchObject({
      syncedCount: 1,
      syncFailedCount: 1,
      lastSyncAttemptAt: "2026-04-12T00:12:00.000Z",
      lastSyncSucceededAt: "2026-04-12T00:11:00.000Z",
      lastSyncError: "network down",
    });
  });

  it("preserves backend metadata when a retry succeeds without fresh identifiers", () => {
    const syncingTrip = markTripSyncing(createTrip({
      status: "completed",
      syncState: "syncFailed",
      backendTripId: "log-1",
      backendEditHref: "/dashboard/logs/driving/log-1/edit",
      backendDistanceKm: 12,
      lastSyncError: "network down",
    }), "2026-04-12T00:12:00.000Z");

    const syncedTrip = markTripSynced(syncingTrip, {}, "2026-04-12T00:13:00.000Z");

    expect(syncedTrip).toMatchObject({
      syncState: "synced",
      backendTripId: "log-1",
      backendEditHref: "/dashboard/logs/driving/log-1/edit",
      backendDistanceKm: 12,
      lastSyncError: undefined,
      lastSyncSucceededAt: "2026-04-12T00:13:00.000Z",
    });
  });

  it("stores backend distance when sync returns a finite computed value", () => {
    const syncedTrip = markTripSynced(
      createTrip({ status: "completed", syncState: "syncing", distanceMeters: 0 }),
      { backendTripId: "log-1", backendDistanceKm: 9.25 },
      "2026-04-12T00:13:00.000Z",
    );

    expect(syncedTrip).toMatchObject({
      syncState: "synced",
      backendTripId: "log-1",
      backendDistanceKm: 9.25,
    });
  });

  it("does not wipe stored backend distance when a later response omits or invalidates it", () => {
    const existingTrip = createTrip({
      status: "completed",
      syncState: "syncing",
      backendTripId: "log-1",
      backendDistanceKm: 9.25,
    });

    expect(markTripSynced(existingTrip, {}, "2026-04-12T00:13:00.000Z").backendDistanceKm).toBe(9.25);
    expect(markTripSynced(existingTrip, { backendDistanceKm: Number.NaN }, "2026-04-12T00:14:00.000Z").backendDistanceKm).toBe(9.25);
  });

  it("keeps failed sync attempts retryable with a stable attempt timestamp", () => {
    const syncingTrip = markTripSyncing(createTrip({ status: "completed", syncState: "pendingSync" }), "2026-04-12T00:12:00.000Z");

    const failedTrip = markTripSyncFailed(syncingTrip, "backend unavailable", "2026-04-12T00:13:00.000Z");

    expect(failedTrip).toMatchObject({
      syncState: "syncFailed",
      lastSyncAttemptAt: "2026-04-12T00:12:00.000Z",
      lastSyncError: "backend unavailable",
      updatedAt: "2026-04-12T00:13:00.000Z",
    });
  });

  it("marks backend-backed deleted trips pending delete sync", () => {
    const deletedTrip = markTripDeleted(createTrip({
      status: "completed",
      syncState: "synced",
      backendTripId: "log-1",
    }), "2026-04-20T01:00:00.000Z");

    expect(deletedTrip).toMatchObject({
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "pendingDelete",
      deletionSyncError: undefined,
    });
  });

  it("treats backend tombstone sync metadata as terminal delete", () => {
    const syncedTrip = markTripSynced(
      createTrip({ status: "completed", syncState: "syncing", backendTripId: "log-1" }),
      { backendTripId: "log-1", deletedAt: "2026-04-20T01:00:00.000Z" },
      "2026-04-20T01:01:00.000Z",
    );

    expect(syncedTrip).toMatchObject({
      backendTripId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "deleted",
    });
  });

  it("counts unsynced tombstones separately from normal trip sync", () => {
    const diagnostics = getTripSyncDiagnostics([
      markTripDeleted(createTrip({ id: "deleted", status: "completed", syncState: "synced", backendTripId: "log-1" }), "2026-04-20T01:00:00.000Z"),
      markTripDeleteSynced(createTrip({ id: "confirmed", status: "completed", syncState: "synced", backendTripId: "log-2" }), "2026-04-20T01:02:00.000Z"),
    ]);

    expect(diagnostics.pendingDeleteCount).toBe(1);
  });

  it("stages, restores, and finalizes mobile delete undo state", () => {
    const trip = createTrip({
      status: "completed",
      syncState: "synced",
      backendTripId: "log-1",
    });

    const stagedTrip = stageTripDelete(trip, "2026-04-20T01:00:07.000Z", "2026-04-20T01:00:00.000Z");
    expect(stagedTrip).toMatchObject({
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "pendingUndo",
      deleteUndoExpiresAt: "2026-04-20T01:00:07.000Z",
    });

    expect(undoTripDelete(stagedTrip, "2026-04-20T01:00:03.000Z")).toMatchObject({
      deletedAt: undefined,
      deletionSyncState: "notDeleted",
      deleteUndoExpiresAt: undefined,
    });

    expect(finalizeTripDelete(stagedTrip, "2026-04-20T01:00:08.000Z")).toMatchObject({
      deletedAt: "2026-04-20T01:00:00.000Z",
      deletionSyncState: "pendingDelete",
      deleteUndoExpiresAt: undefined,
    });
  });
});
