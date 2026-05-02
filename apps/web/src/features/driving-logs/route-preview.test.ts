import { describe, expect, it } from "vitest";
import { getDrivingLogRouteCoordinates, getNextExpandedLogId, getRouteEndpoint } from "./route-preview";

describe("driving log route preview helpers", () => {
  it("keeps valid route coordinates and removes malformed samples", () => {
    expect(getDrivingLogRouteCoordinates([
      { latitude: -37.8136, longitude: 144.9631 },
      { latitude: Number.NaN, longitude: 144.9631 },
      { latitude: -91, longitude: 144.9631 },
      { latitude: -37.82, longitude: 144.97 },
    ])).toEqual([
      { lat: -37.8136, lng: 144.9631 },
      { lat: -37.82, lng: 144.97 },
    ]);
  });

  it("reduces long routes while preserving the final coordinate", () => {
    const coordinates = getDrivingLogRouteCoordinates(
      Array.from({ length: 10 }, (_, index) => ({
        latitude: -37 + index / 1000,
        longitude: 144 + index / 1000,
      })),
      3,
    );

    expect(coordinates).toHaveLength(4);
    expect(coordinates.at(-1)).toEqual({ lat: -36.991, lng: 144.009 });
  });

  it("toggles one expanded row at a time", () => {
    expect(getNextExpandedLogId(null, "log-1")).toBe("log-1");
    expect(getNextExpandedLogId("log-1", "log-1")).toBeNull();
    expect(getNextExpandedLogId("log-1", "log-2")).toBe("log-2");
  });

  it("builds an encoded route endpoint", () => {
    expect(getRouteEndpoint("log 1/route")).toBe("/api/logs/driving/log%201%2Froute/route");
  });
});
