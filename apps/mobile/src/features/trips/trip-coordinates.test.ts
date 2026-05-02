import { describe, expect, it } from "vitest";
import type { TrackingSampleRecord } from "./mobile-tracking/types";
import { formatTripCoordinate, getTripCoordinateSummary } from "./trip-coordinates";

function createSample(overrides: Partial<TrackingSampleRecord> = {}): TrackingSampleRecord {
  return {
    sessionId: "trip-1",
    latitude: -37.8136,
    longitude: 144.9631,
    accuracyMeters: 8,
    timestampMs: 1,
    recordedAt: "2026-04-12T00:00:01.000Z",
    source: "expo-background-location",
    originId: "sample-1",
    sequence: 1,
    ...overrides,
  };
}

describe("trip coordinate summary", () => {
  it("uses the first valid live sample as start and latest valid sample as current", () => {
    const summary = getTripCoordinateSummary([
      createSample({ sequence: 2, latitude: -37.82, longitude: 144.97 }),
      createSample({ sequence: 1, latitude: -37.8136, longitude: 144.9631 }),
    ]);

    expect(summary.start).toEqual({ latitude: -37.8136, longitude: 144.9631 });
    expect(summary.current).toEqual({ latitude: -37.82, longitude: 144.97 });
  });

  it("uses the first valid completed sample as start and last valid sample as finish", () => {
    const summary = getTripCoordinateSummary([
      createSample({ sequence: 1, latitude: -37.8136, longitude: 144.9631 }),
      createSample({ sequence: 3, latitude: -37.90021, longitude: 145.10233 }),
      createSample({ sequence: 2, latitude: -37.82041, longitude: 144.97182 }),
    ]);

    expect(summary.start).toEqual({ latitude: -37.8136, longitude: 144.9631 });
    expect(summary.finish).toEqual({ latitude: -37.90021, longitude: 145.10233 });
  });

  it("ignores malformed samples safely", () => {
    const summary = getTripCoordinateSummary([
      createSample({ sequence: 1, latitude: Number.NaN, longitude: 144.9631 }),
      createSample({ sequence: 2, latitude: -91, longitude: 144.9631 }),
      createSample({ sequence: 3, latitude: -37.82, longitude: 144.97 }),
    ]);

    expect(summary.start).toEqual({ latitude: -37.82, longitude: 144.97 });
    expect(summary.current).toEqual({ latitude: -37.82, longitude: 144.97 });
  });

  it("falls back cleanly when no samples exist", () => {
    expect(getTripCoordinateSummary([])).toEqual({
      start: undefined,
      current: undefined,
      finish: undefined,
    });
    expect(formatTripCoordinate(undefined)).toBe("Not available");
  });

  it("formats coordinates to five decimal places", () => {
    expect(formatTripCoordinate({ latitude: -37.813604, longitude: 144.963104 })).toBe("-37.81360, 144.96310");
  });
});
