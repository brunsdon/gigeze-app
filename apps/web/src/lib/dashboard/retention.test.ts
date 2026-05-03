import { describe, expect, it } from "vitest";
import {
  buildWeeklySummary,
  detectMilestones,
  getShareJourneyPrompt,
  hasWeeklyActivity,
  shouldPromptInvite,
} from "@/lib/dashboard/retention";

describe("dashboard retention helpers", () => {
  it("builds weekly summary from local seven-day window", () => {
    const now = new Date(2026, 3, 7, 12, 0, 0);
    const summary = buildWeeklySummary({
      now,
      drivingLogs: [
        {
          date: new Date(2026, 3, 6, 9, 0, 0),
          startOdometer: 100,
          endOdometer: 180,
        },
      ],
      Gigs: [{ createdAt: new Date(2026, 3, 5, 8, 0, 0) }],
      mediaItems: [{ createdAt: new Date(2026, 3, 4, 18, 0, 0) }],
    });

    expect(summary.distanceKm).toBe(80);
    expect(summary.stopsCount).toBe(1);
    expect(summary.mediaCount).toBe(1);
    expect(hasWeeklyActivity(summary)).toBe(true);
  });

  it("detects configured milestones from existing records", () => {
    const milestones = detectMilestones({
      Tours: [
        {
          id: "j1",
          slug: "one",
          visibility: "PUBLIC",
          Gigs: [{ id: "s1" }],
        },
      ],
      totalStops: 11,
      totalDistanceKm: 140,
    });

    expect(milestones.map((item) => item.id)).toEqual([
      "first-Tour",
      "ten-Gigs",
      "hundred-km",
      "first-shared-Tour",
    ]);
  });

  it("returns share prompt only for public active Tour with sufficient content", () => {
    const prompt = getShareJourneyPrompt({
      activeJourney: {
        id: "j1",
        slug: "coast-trip",
        visibility: "PUBLIC",
        Gigs: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      },
      mediaItems: [],
    });

    expect(prompt?.href).toBe("/tours/coast-trip/story");
  });

  it("prompts invite only when active Tour exists and no members invited", () => {
    expect(
      shouldPromptInvite({
        hasActiveJourney: true,
        memberCount: 1,
        invitationCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldPromptInvite({
        hasActiveJourney: true,
        memberCount: 2,
        invitationCount: 0,
      }),
    ).toBe(false);
  });
});
