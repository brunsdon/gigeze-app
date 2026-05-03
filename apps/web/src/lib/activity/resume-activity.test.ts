import { describe, expect, it } from "vitest";
import { parseStoredActivity, toTrackedActivity } from "@/lib/activity/resume-activity";

describe("resume activity", () => {
  it("matches meaningful edit and moment routes", () => {
    expect(toTrackedActivity("/dashboard/tours/Tour-1/edit")?.label).toBe("Continue editing a Tour");
    expect(toTrackedActivity("/dashboard/tours/Tour-1/gigs/Gig-1/edit")?.label).toBe("Continue editing a Gig");
    expect(toTrackedActivity("/dashboard/logs/driving/log-1/edit")?.label).toBe("Continue editing a driving log");
    expect(toTrackedActivity("/dashboard/activity/note-1/edit")?.label).toBe("Continue editing activity");
    expect(toTrackedActivity("/dashboard/media")?.label).toBe("Continue adding moments");
    expect(toTrackedActivity("/dashboard/media/media-1/edit")?.label).toBe("Continue editing uploaded moment details");
  });

  it("returns null for non-meaningful routes", () => {
    expect(toTrackedActivity("/dashboard")).toBeNull();
    expect(toTrackedActivity("/dashboard/tours")).toBeNull();
    expect(toTrackedActivity("/dashboard/logs/driving")).toBeNull();
  });

  it("rejects stale or invalid stored activity", () => {
    expect(parseStoredActivity("not-json")).toBeNull();
    expect(parseStoredActivity(JSON.stringify({ href: "/dashboard/media" }))).toBeNull();

    const now = 1_700_000_000_000;
    const stale = {
      href: "/dashboard/media",
      label: "Continue adding moments",
      updatedAt: now - 1000 * 60 * 60 * 24 * 30,
    };
    expect(parseStoredActivity(JSON.stringify(stale), now)).toBeNull();
  });

  it("parses fresh stored activity", () => {
    const now = 1_700_000_000_000;
    const fresh = {
      href: "/dashboard/media",
      label: "Continue adding moments",
      updatedAt: now - 1000,
    };

    expect(parseStoredActivity(JSON.stringify(fresh), now)).toEqual(fresh);
  });
});
