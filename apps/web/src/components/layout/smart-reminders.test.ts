import { describe, expect, it } from "vitest";
import { buildSmartReminders } from "@/components/layout/smart-reminders";

describe("smart reminders", () => {
  it("prioritizes active Tour setup and first Gig guidance", () => {
    const reminders = buildSmartReminders({
      hasJourneys: true,
      hasActiveJourney: false,
      activeJourneyHasStops: false,
      hasDrivingLogs: false,
      lastWeekDrivingKm: 0,
      lastWeekActivityHours: 0,
      mediaCount: 0,
      showInvitePrompt: false,
    });

    expect(reminders[0]?.id).toBe("set-active-Tour");
  });

  it("adds activity prompts when weekly logs are low", () => {
    const reminders = buildSmartReminders({
      hasJourneys: true,
      hasActiveJourney: true,
      activeJourneyId: "Tour-1",
      activeJourneyHasStops: true,
      hasDrivingLogs: true,
      lastWeekDrivingKm: 12,
      lastWeekActivityHours: 0,
      mediaCount: 1,
      showInvitePrompt: false,
    });

    expect(reminders.map((item) => item.id)).toEqual([
      "log-week-driving",
      "log-week-activity",
      "capture-moment",
    ]);
  });

  it("returns empty when Tour activity looks healthy", () => {
    const reminders = buildSmartReminders({
      hasJourneys: true,
      hasActiveJourney: true,
      activeJourneyId: "Tour-1",
      activeJourneyHasStops: true,
      hasDrivingLogs: true,
      lastWeekDrivingKm: 220,
      lastWeekActivityHours: 6,
      mediaCount: 8,
      showInvitePrompt: false,
    });

    expect(reminders).toHaveLength(0);
  });

  it("adds share and invite prompts when configured", () => {
    const reminders = buildSmartReminders({
      hasJourneys: true,
      hasActiveJourney: true,
      activeJourneyId: "Tour-1",
      activeJourneyHasStops: true,
      hasDrivingLogs: true,
      lastWeekDrivingKm: 180,
      lastWeekActivityHours: 5,
      mediaCount: 8,
      shareJourneyHref: "/Tours/Tour-1/story",
      showInvitePrompt: true,
    });

    expect(reminders.map((item) => item.id)).toEqual([
      "share-Tour",
      "invite-others",
    ]);
  });
});
