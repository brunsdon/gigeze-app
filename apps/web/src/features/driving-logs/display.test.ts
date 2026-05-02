import { describe, expect, it } from "vitest";
import { getDrivingLogSplitDisplay } from "./display";

describe("driving log split display", () => {
  it("omits noisy zero-business details for personal-only trips", () => {
    expect(getDrivingLogSplitDisplay({
      splitEnabled: true,
      businessKm: 0,
      personalKm: 7,
      totalKm: 7,
      tripType: "driving",
    })).toEqual({
      showDetails: true,
      primaryText: "Personal",
      badgeText: "Personal",
    });
  });

  it("keeps both business and personal details when business distance exists", () => {
    expect(getDrivingLogSplitDisplay({
      splitEnabled: true,
      businessKm: 3,
      personalKm: 4,
      totalKm: 7,
      tripType: "driving",
    })).toEqual({
      showDetails: true,
      primaryText: "Business: 3 km",
      secondaryText: "Personal: 4 km",
      badgeText: "Business 3 km · Personal 4 km",
    });
  });
});
