import { formatDistanceKm } from "@gigeze/shared";
import { describe, expect, it } from "vitest";
import type { TrackingSampleRecord } from "./mobile-tracking/types";
import { calculateSampleDistanceKm, getCompletedTripDistanceKilometers } from "./trip-distance";
import type { MobileTripSession } from "./trip-workflow";

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "completed",
    startedAt: "2026-04-12T00:00:00.000Z",
    endedAt: "2026-04-12T00:10:00.000Z",
    distanceMeters: 0,
    title: "Trip 12/04/2026",
    sampleCount: 0,
    captureMode: "tracking",
    syncState: "pendingSync",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:10:00.000Z",
    ...overrides,
  };
}

function createSample(overrides: Partial<TrackingSampleRecord> = {}): TrackingSampleRecord {
  return {
    sessionId: "trip-1",
    latitude: -33.86,
    longitude: 151.2,
    accuracyMeters: 8,
    timestampMs: 1,
    recordedAt: "2026-04-12T00:00:01.000Z",
    source: "expo-background-location",
    originId: "sample-1",
    sequence: 1,
    ...overrides,
  };
}

describe("completed trip distance display", () => {
  it("prefers stored backend distance over a zero local summary distance", () => {
    expect(getCompletedTripDistanceKilometers(createTrip({ backendDistanceKm: 8.34, distanceMeters: 0 }), 5)).toBe(8.34);
  });

  it("uses locally computed sample distance for unsynced trips", () => {
    const sampleDistanceKm = calculateSampleDistanceKm([
      createSample({ sequence: 2, latitude: -33.9 }),
      createSample({ sequence: 1, latitude: -33.86 }),
    ]);

    expect(getCompletedTripDistanceKilometers(createTrip({ syncState: "pendingSync", distanceMeters: 0 }), sampleDistanceKm)).toBeGreaterThan(4);
  });

  it("falls back to stored distance meters when no backend distance or samples are available", () => {
    expect(getCompletedTripDistanceKilometers(createTrip({ distanceMeters: 1234 }), 0)).toBe(1.234);
    expect(formatDistanceKm(getCompletedTripDistanceKilometers(createTrip({ distanceMeters: 0 }), 0))).toBe("0 km");
  });

  it("formats short and whole-kilometer trip distances consistently", () => {
    expect(formatDistanceKm(0.4)).toBe("0.4 km");
    expect(formatDistanceKm(1)).toBe("1 km");
    expect(formatDistanceKm(1.2)).toBe("1.2 km");
  });

  it("keeps very short completed trips visible above zero", () => {
    expect(getCompletedTripDistanceKilometers(createTrip({ backendDistanceKm: 0.04, distanceMeters: 0 }), 0)).toBe(0.04);
    expect(formatDistanceKm(getCompletedTripDistanceKilometers(createTrip({ backendDistanceKm: 0.04, distanceMeters: 0 }), 0))).toBe("0.1 km");
  });

  it("does not accumulate stationary GPS jitter as trip distance", () => {
    const sampleDistanceKm = calculateSampleDistanceKm([
      createSample({ sequence: 1, latitude: -33.86, longitude: 151.2, timestampMs: 0, accuracyMeters: 8 }),
      createSample({ sequence: 2, latitude: -33.860015, longitude: 151.200015, timestampMs: 5000, accuracyMeters: 8 }),
      createSample({ sequence: 3, latitude: -33.860025, longitude: 151.20002, timestampMs: 10000, accuracyMeters: 8 }),
    ]);

    expect(sampleDistanceKm).toBe(0);
  });

  it("still accumulates real movement above the drift threshold", () => {
    const sampleDistanceKm = calculateSampleDistanceKm([
      createSample({ sequence: 1, latitude: -33.86, longitude: 151.2, timestampMs: 0, accuracyMeters: 8 }),
      createSample({ sequence: 2, latitude: -33.861, longitude: 151.2, timestampMs: 120000, accuracyMeters: 8 }),
    ]);

    expect(sampleDistanceKm).toBeGreaterThan(0.1);
  });

  it("ignores poor-accuracy samples for movement accumulation", () => {
    const sampleDistanceKm = calculateSampleDistanceKm([
      createSample({ sequence: 1, latitude: -33.86, longitude: 151.2, timestampMs: 0, accuracyMeters: 8 }),
      createSample({ sequence: 2, latitude: -33.9, longitude: 151.2, timestampMs: 120000, accuracyMeters: 80 }),
    ]);

    expect(sampleDistanceKm).toBe(0);
  });

  it("transitions from stationary jitter to moving without counting the jitter", () => {
    const sampleDistanceKm = calculateSampleDistanceKm([
      createSample({ sequence: 1, latitude: -33.86, longitude: 151.2, timestampMs: 0, accuracyMeters: 8 }),
      createSample({ sequence: 2, latitude: -33.86001, longitude: 151.20001, timestampMs: 5000, accuracyMeters: 8 }),
      createSample({ sequence: 3, latitude: -33.861, longitude: 151.2, timestampMs: 65000, accuracyMeters: 8 }),
    ]);

    expect(sampleDistanceKm).toBeGreaterThan(0.1);
    expect(sampleDistanceKm).toBeLessThan(0.12);
  });
});
