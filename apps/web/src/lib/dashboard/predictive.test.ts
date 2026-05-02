import { describe, expect, it } from "vitest";
import { buildPassiveActivitySuggestions } from "@/lib/dashboard/predictive";

describe("predictive dashboard suggestions", () => {
  it("suggests add Gig after significant Gig gap", () => {
    const now = new Date("2026-04-07T12:00:00.000Z");
    const suggestions = buildPassiveActivitySuggestions(
      {
        id: "Tour-1",
        Gigs: [
          {
            id: "Gig-1",
            title: "Town A",
            locationName: "Town A",
            latitude: -33.86,
            longitude: 151.21,
            createdAt: new Date("2026-04-05T00:00:00.000Z"),
          },
        ],
      },
      [],
      now,
    );

    expect(suggestions.map((item) => item.id)).toContain("add-Gig-here");
  });

  it("suggests driving log when recent movement exists and logs are stale", () => {
    const now = new Date("2026-04-07T12:00:00.000Z");
    const suggestions = buildPassiveActivitySuggestions(
      {
        id: "Tour-1",
        Gigs: [
          {
            id: "Gig-1",
            title: "Town A",
            locationName: "Town A",
            latitude: -34.9285,
            longitude: 138.6007,
            createdAt: new Date("2026-04-06T08:00:00.000Z"),
          },
          {
            id: "Gig-2",
            title: "Town B",
            locationName: "Town B",
            latitude: -35.2809,
            longitude: 149.13,
            createdAt: new Date("2026-04-07T00:00:00.000Z"),
          },
        ],
      },
      [{ date: new Date("2026-04-01T00:00:00.000Z") }],
      now,
    );

    expect(suggestions.map((item) => item.id)).toContain("create-driving-log");
  });
});
