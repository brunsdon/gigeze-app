import { describe, expect, it } from "vitest";
import { getLiveTripLocationPoints } from "./live-trip-display";

describe("live trip display", () => {
  it("uses the first valid sample as trip start and the latest valid sample as current location", () => {
    const locationPoints = getLiveTripLocationPoints([
      {
        latitude: -37.74291,
        longitude: 144.97015,
        recordedAt: "2026-04-21T00:14:00.000Z",
        sequence: 3,
      },
      {
        latitude: -37.74315,
        longitude: 144.96611,
        recordedAt: "2026-04-21T00:05:00.000Z",
        sequence: 1,
      },
      {
        latitude: -37.74297,
        longitude: 144.97023,
        recordedAt: "2026-04-21T00:08:00.000Z",
        sequence: 2,
      },
    ]);

    expect(locationPoints).toEqual({
      start: {
        coordinate: {
          latitude: -37.74315,
          longitude: 144.96611,
        },
        recordedAt: "2026-04-21T00:05:00.000Z",
      },
      current: {
        coordinate: {
          latitude: -37.74291,
          longitude: 144.97015,
        },
        recordedAt: "2026-04-21T00:14:00.000Z",
      },
    });
  });

  it("ignores malformed coordinate samples safely", () => {
    const locationPoints = getLiveTripLocationPoints([
      {
        latitude: Number.NaN,
        longitude: 144.96611,
        recordedAt: "2026-04-21T00:05:00.000Z",
        sequence: 1,
      },
      {
        latitude: -37.74297,
        longitude: 144.97023,
        recordedAt: "2026-04-21T00:08:00.000Z",
        sequence: 2,
      },
    ]);

    expect(locationPoints).toEqual({
      start: {
        coordinate: {
          latitude: -37.74297,
          longitude: 144.97023,
        },
        recordedAt: "2026-04-21T00:08:00.000Z",
      },
      current: {
        coordinate: {
          latitude: -37.74297,
          longitude: 144.97023,
        },
        recordedAt: "2026-04-21T00:08:00.000Z",
      },
    });
  });

  it("returns empty points when no valid samples exist", () => {
    expect(getLiveTripLocationPoints([])).toEqual({
      start: undefined,
      current: undefined,
    });
  });
});
