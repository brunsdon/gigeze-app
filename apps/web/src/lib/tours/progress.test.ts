import { describe, expect, it } from "vitest";
import { getCompletedStopsCount, getJourneyProgressPercent } from "@/lib/tours/progress";

describe("Tour progress", () => {
  it("returns zero progress for empty Tours", () => {
    expect(getCompletedStopsCount([])).toBe(0);
    expect(getJourneyProgressPercent([])).toBe(0);
  });

  it("counts completed Gigs from arrival/departure dates", () => {
    const Gigs = [
      { arrivalDate: new Date("2026-04-01T00:00:00.000Z"), departureDate: null },
      { arrivalDate: null, departureDate: new Date("2026-04-02T00:00:00.000Z") },
      { arrivalDate: null, departureDate: null },
    ];

    expect(getCompletedStopsCount(Gigs)).toBe(2);
    expect(getJourneyProgressPercent(Gigs)).toBe(67);
  });
});