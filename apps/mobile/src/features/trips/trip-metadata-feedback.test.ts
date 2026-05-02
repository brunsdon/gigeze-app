import { describe, expect, it } from "vitest";
import { getTripMetadataEditStatus } from "./trip-metadata-feedback";
import type { MobileTripSession } from "./trip-workflow";

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "completed",
    startedAt: "2026-04-12T00:00:00.000Z",
    endedAt: "2026-04-12T00:10:00.000Z",
    distanceMeters: 1000,
    title: "Trip",
    sampleCount: 0,
    captureMode: "tracking",
    syncState: "synced",
    backendTripId: "log-1",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:10:00.000Z",
    ...overrides,
  };
}

describe("getTripMetadataEditStatus", () => {
  it("shows immediate local saving feedback", () => {
    expect(getTripMetadataEditStatus(createTrip(), true)).toEqual({
      label: "Saving locally...",
      tone: "neutral",
    });
  });

  it("shows saved locally feedback for pending sync", () => {
    expect(getTripMetadataEditStatus(createTrip({ syncState: "pendingSync" }), false)).toEqual({
      label: "Saved locally · Pending sync",
      tone: "warning",
    });
  });

  it("shows synced feedback after backend sync succeeds", () => {
    expect(getTripMetadataEditStatus(createTrip({ syncState: "synced", lastSyncSucceededAt: "2026-04-12T00:11:00.000Z" }), false)).toEqual({
      label: "Synced",
      tone: "success",
    });
  });

  it("shows retry-safe failure feedback with the last sync error", () => {
    expect(getTripMetadataEditStatus(createTrip({ syncState: "syncFailed", lastSyncError: "offline" }), false)).toEqual({
      label: "Sync failed · Will retry",
      detail: "offline",
      tone: "danger",
    });
  });

  it("hides metadata feedback for deleted trips", () => {
    expect(getTripMetadataEditStatus(createTrip({ deletedAt: "2026-04-20T01:00:00.000Z" }), false)).toBeNull();
  });
});
