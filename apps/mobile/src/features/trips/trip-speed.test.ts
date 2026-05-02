import { describe, expect, it } from "vitest";
import type { TrackingSampleRecord } from "./mobile-tracking/types";
import { formatSpeedKmh, getCurrentSpeedKmh, shouldUseProviderSpeed } from "./trip-speed";

function createSample(overrides: Partial<TrackingSampleRecord> & { speedMetersPerSecond?: number | null } = {}): TrackingSampleRecord & { speedMetersPerSecond?: number | null } {
  return {
    sessionId: "trip-1",
    latitude: -37.8136,
    longitude: 144.9631,
    accuracyMeters: 8,
    timestampMs: 1000,
    recordedAt: "2026-04-12T00:00:01.000Z",
    source: "expo-foreground-location",
    originId: "sample-1",
    sequence: 1,
    ...overrides,
  };
}

describe("trip speed", () => {
  it("derives current speed from the two latest valid GPS samples", () => {
    const speedKmh = getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136 }),
      createSample({ sequence: 2, timestampMs: 60_000, latitude: -37.8226 }),
    ]);

    expect(speedKmh).toBeGreaterThan(55);
    expect(speedKmh).toBeLessThan(65);
  });

  it("ignores malformed samples and falls back when speed cannot be calculated", () => {
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, latitude: Number.NaN }),
      createSample({ sequence: 2, latitude: -91 }),
    ])).toBeUndefined();
    expect(getCurrentSpeedKmh([createSample()])).toBeUndefined();
  });

  it("returns stationary speed for GPS jitter below the movement threshold", () => {
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136, longitude: 144.9631, accuracyMeters: 8 }),
      createSample({ sequence: 2, timestampMs: 5000, latitude: -37.81361, longitude: 144.96311, accuracyMeters: 8 }),
    ])).toBe(0);
  });

  it("ignores poor-accuracy movement for speed", () => {
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136, longitude: 144.9631, accuracyMeters: 8 }),
      createSample({ sequence: 2, timestampMs: 60000, latitude: -37.8226, longitude: 144.9631, accuracyMeters: 80 }),
    ])).toBe(0);
  });

  it("formats speed as rounded integer text with a safe fallback", () => {
    expect(formatSpeedKmh(86.6)).toBe("87");
    expect(formatSpeedKmh(undefined)).toBe("--");
    expect(formatSpeedKmh(Number.NaN)).toBe("--");
  });

  it("prefers provider speed over computed segment speed", () => {
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136 }),
      createSample({ sequence: 2, timestampMs: 60_000, latitude: -37.8226, speedMetersPerSecond: 20 }),
    ])).toBe(72);
  });

  it("ignores provider speed when latest GPS accuracy is poor", () => {
    expect(shouldUseProviderSpeed(createSample({ accuracyMeters: 60, speedMetersPerSecond: 9 }))).toBe(false);
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136, longitude: 144.9631, accuracyMeters: 60 }),
      createSample({ sequence: 2, timestampMs: 1000, latitude: -37.81362, longitude: 144.96311, accuracyMeters: 60, speedMetersPerSecond: 9 }),
    ])).toBe(0);
  });

  it("still uses provider speed promptly when GPS accuracy is acceptable", () => {
    expect(shouldUseProviderSpeed(createSample({ accuracyMeters: 12, speedMetersPerSecond: 9 }))).toBe(true);
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136, accuracyMeters: 12 }),
      createSample({ sequence: 2, timestampMs: 1000, latitude: -37.81362, accuracyMeters: 12, speedMetersPerSecond: 9 }),
    ])).toBe(32.4);
  });

  it("suppresses computed speed from low-confidence GPS fixes", () => {
    expect(getCurrentSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136, longitude: 144.9631, accuracyMeters: 40 }),
      createSample({ sequence: 2, timestampMs: 60_000, latitude: -37.8226, longitude: 144.9631, accuracyMeters: 40 }),
    ])).toBe(0);
  });
});
