import { describe, expect, it } from "vitest";
import { getDrivingLogEndPoint, getDrivingLogStartPoint } from "@/features/driving-logs/points";

describe("driving log points", () => {
  it("returns null when coordinates are missing", () => {
    expect(getDrivingLogStartPoint({ startLocation: "Coburg VIC" })).toBeNull();
    expect(getDrivingLogEndPoint({ endLatitude: -37.765, endLocation: "Brunswick VIC" })).toBeNull();
  });

  it("returns mapping-friendly start and end points", () => {
    expect(
      getDrivingLogStartPoint({
        startLatitude: "-37.743110",
        startLongitude: "144.969830",
        startFormattedAddress: "Coburg VIC, Australia",
        startPlaceId: "start-place",
      }),
    ).toEqual({
      latitude: -37.74311,
      longitude: 144.96983,
      label: "Coburg VIC, Australia",
      placeId: "start-place",
    });

    expect(
      getDrivingLogEndPoint({
        endLatitude: -37.765,
        endLongitude: 144.961,
        endLocation: "Brunswick VIC",
      }),
    ).toEqual({
      latitude: -37.765,
      longitude: 144.961,
      label: "Brunswick VIC",
      placeId: null,
    });
  });
});
