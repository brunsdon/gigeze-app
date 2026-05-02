import { describe, expect, it } from "vitest";
import { calculateJourneyHighlights, groupStopsByDay, selectHeroMediaMoment } from "@/features/tours/storytelling";

describe("Tour storytelling utilities", () => {
  it("groups Gigs into chronological day sections with day labels", () => {
    const groups = groupStopsByDay([
      {
        id: "s2",
        title: "Second",
        orderIndex: 2,
        createdAt: new Date(2026, 3, 8, 10, 0, 0),
      },
      {
        id: "s1",
        title: "First",
        orderIndex: 1,
        createdAt: new Date(2026, 3, 7, 8, 0, 0),
      },
      {
        id: "s3",
        title: "Third",
        orderIndex: 3,
        createdAt: new Date(2026, 3, 8, 18, 0, 0),
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.dayLabel).toBe("Day 1");
    expect(groups[1]?.dayLabel).toBe("Day 2");
    expect(groups[0]?.Gigs.map((Gig) => Gig.id)).toEqual(["s1"]);
    expect(groups[1]?.Gigs.map((Gig) => Gig.id)).toEqual(["s2", "s3"]);
  });

  it("calculates longest drive, top media Gig, and busiest day", () => {
    const highlights = calculateJourneyHighlights({
      Gigs: [
        {
          id: "s1",
          title: "Harbour",
          orderIndex: 1,
          createdAt: new Date("2026-04-07T09:00:00.000Z"),
        },
        {
          id: "s2",
          title: "Ranges",
          orderIndex: 2,
          createdAt: new Date("2026-04-08T09:00:00.000Z"),
        },
      ],
      mediaItems: [
        { id: "m1", stopId: "s2", createdAt: new Date("2026-04-08T11:00:00.000Z") },
        { id: "m2", stopId: "s2", createdAt: new Date("2026-04-08T12:00:00.000Z") },
        { id: "m3", stopId: "s1", createdAt: new Date("2026-04-07T12:00:00.000Z") },
      ],
      drivingLogs: [
        {
          date: new Date("2026-04-08T08:00:00.000Z"),
          startOdometer: 100,
          endOdometer: 260,
          startLocation: "Town A",
          endLocation: "Town B",
        },
      ],
      activityNotes: [{ date: new Date("2026-04-08T13:00:00.000Z") }],
    });

    expect(highlights.longestDrive?.distanceKm).toBe(160);
    expect(highlights.stopWithMostMedia?.stopId).toBe("s2");
    expect(highlights.busiestDay?.activityCount).toBe(5);
  });

  it("selects hero media from the Gig with most media first", () => {
    const hero = selectHeroMediaMoment({
      Gigs: [
        { id: "s1", title: "Coast", orderIndex: 1, createdAt: new Date("2026-04-07T08:00:00.000Z") },
        { id: "s2", title: "Forest", orderIndex: 2, createdAt: new Date("2026-04-08T08:00:00.000Z") },
      ],
      mediaItems: [
        {
          id: "m1",
          stopId: "s2",
          publicUrl: "https://example.com/one.jpg",
          createdAt: new Date("2026-04-08T10:00:00.000Z"),
        },
        {
          id: "m2",
          stopId: "s2",
          publicUrl: "https://example.com/two.jpg",
          createdAt: new Date("2026-04-08T12:00:00.000Z"),
        },
      ],
    });

    expect(hero?.strategy).toBe("busiest-Gig");
    expect(hero?.mediaUrl).toBe("https://example.com/two.jpg");
    expect(hero?.stopTitle).toBe("Forest");
  });
});
