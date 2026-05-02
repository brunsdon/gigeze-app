import { describe, expect, it } from "vitest";
import { stopUpdateSchema } from "@/lib/validation/Gig";

describe("Gig validation", () => {
  it("rejects departure date earlier than arrival date", () => {
    const parsed = stopUpdateSchema.safeParse({
      journeyId: "Tour-1",
      title: "Camp",
      description: "Overnight camp",
      latitude: -33.8,
      longitude: 151.2,
      locationName: "Sydney",
      arrivalDate: "2026-04-10",
      departureDate: "2026-04-09",
      isPublic: true,
      orderIndex: 1,
    });

    expect(parsed.success).toBe(false);
  });
});
