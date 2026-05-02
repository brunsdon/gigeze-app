import { describe, expect, it } from "vitest";
import type { TrackingSampleRecord } from "./mobile-tracking/types";
import {
  getTripRouteCoordinates,
  getTripRouteInitialRegion,
  getTripRouteMarkers,
  hasTripRouteMap,
} from "./trip-route-map";

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

describe("trip route map helpers", () => {
  it("derives sorted route coordinates from valid trip samples", () => {
    const coordinates = getTripRouteCoordinates([
      createSample({ sequence: 2, latitude: -37.82, longitude: 144.97 }),
      createSample({ sequence: 1, latitude: -37.8136, longitude: 144.9631 }),
    ]);

    expect(coordinates).toEqual([
      { latitude: -37.8136, longitude: 144.9631 },
      { latitude: -37.82, longitude: 144.97 },
    ]);
  });

  it("ignores malformed route samples safely", () => {
    const coordinates = getTripRouteCoordinates([
      createSample({ sequence: 1, latitude: Number.NaN, longitude: 144.9631 }),
      createSample({ sequence: 2, latitude: -37.82, longitude: 181 }),
      createSample({ sequence: 3, latitude: -37.83, longitude: 144.98 }),
    ]);

    expect(coordinates).toEqual([{ latitude: -37.83, longitude: 144.98 }]);
    expect(hasTripRouteMap(coordinates)).toBe(false);
  });

  it("uses first and last valid route points as start and finish markers", () => {
    const coordinates = getTripRouteCoordinates([
      createSample({ sequence: 1, latitude: -37.8136, longitude: 144.9631 }),
      createSample({ sequence: 2, latitude: -37.82, longitude: 144.97 }),
      createSample({ sequence: 3, latitude: -37.90021, longitude: 145.10233 }),
    ]);

    expect(getTripRouteMarkers(coordinates)).toEqual({
      start: { latitude: -37.8136, longitude: 144.9631 },
      finish: { latitude: -37.90021, longitude: 145.10233 },
    });
  });

  it("builds a padded initial region around route bounds", () => {
    const region = getTripRouteInitialRegion([
      { latitude: -37.8, longitude: 144.9 },
      { latitude: -37.9, longitude: 145.1 },
    ]);

    expect(region?.latitude).toBeCloseTo(-37.85);
    expect(region?.longitude).toBeCloseTo(145);
    expect(region?.latitudeDelta).toBeCloseTo(0.15);
    expect(region?.longitudeDelta).toBeCloseTo(0.3);
  });

  it("falls back cleanly when no route coordinates exist", () => {
    expect(getTripRouteInitialRegion([])).toBeUndefined();
    expect(getTripRouteMarkers([])).toEqual({
      start: undefined,
      finish: undefined,
    });
  });
});
