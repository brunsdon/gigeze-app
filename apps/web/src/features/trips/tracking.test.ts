import { describe, expect, it } from "vitest";
import {
  appendTripSample,
  buildRoutePolyline,
  calculateTripDistanceKm,
  detectStopSuggestions,
  type TripSample,
} from "@/features/trips/tracking";

function sample(latitude: number, longitude: number, recordedAt: string): TripSample {
  return {
    latitude,
    longitude,
    accuracyMeters: 6,
    recordedAt,
  };
}

describe("trip tracking helpers", () => {
  it("calculates cumulative trip distance from sampled coordinates", () => {
    const samples = [
      sample(-33.8688, 151.2093, "2026-04-07T00:00:00.000Z"),
      sample(-33.8708, 151.2153, "2026-04-07T00:00:30.000Z"),
      sample(-33.8728, 151.2213, "2026-04-07T00:01:00.000Z"),
    ];

    const distanceKm = calculateTripDistanceKm(samples);
    expect(distanceKm).toBeGreaterThan(1);
    expect(distanceKm).toBeLessThan(2);
  });

  it("ignores improbable GPS jumps when appending samples", () => {
    const samples = [sample(-33.8688, 151.2093, "2026-04-07T00:00:00.000Z")];
    const jump = sample(-32.8688, 152.2093, "2026-04-07T00:00:30.000Z");

    const result = appendTripSample(samples, jump, 3);
    expect(result.samples).toHaveLength(1);
    expect(result.distanceIncrementKm).toBe(0);
  });

  it("reduces route polyline points for long tracks", () => {
    const samples = Array.from({ length: 500 }, (_, index) =>
      sample(-33.86 + index * 0.0001, 151.2 + index * 0.0001, `2026-04-07T00:${String(index % 60).padStart(2, "0")}:00.000Z`),
    );

    const polyline = buildRoutePolyline(samples, 120);
    expect(polyline.length).toBeLessThanOrEqual(121);
    expect(polyline[0]).toEqual({ latitude: samples[0].latitude, longitude: samples[0].longitude });
    expect(polyline[polyline.length - 1]).toEqual({
      latitude: samples[samples.length - 1].latitude,
      longitude: samples[samples.length - 1].longitude,
    });
  });

  it("detects Gig suggestions from dwell clusters", () => {
    const baseLat = -33.8688;
    const baseLon = 151.2093;
    const cluster = Array.from({ length: 14 }, (_, index) =>
      sample(
        baseLat + (index % 2 === 0 ? 0.00001 : -0.00001),
        baseLon + (index % 2 === 0 ? 0.00001 : -0.00001),
        new Date(2026, 3, 7, 8, index, 0).toISOString(),
      ),
    );
    const moved = sample(baseLat + 0.02, baseLon + 0.02, new Date(2026, 3, 7, 8, 20, 0).toISOString());

    const suggestions = detectStopSuggestions([...cluster, moved]);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].dwellMinutes).toBeGreaterThanOrEqual(10);
  });
});
