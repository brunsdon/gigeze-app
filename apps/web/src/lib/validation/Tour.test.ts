import { describe, expect, it } from "vitest";
import { journeyUpdateSchema } from "@/lib/validation/Tour";

describe("Tour validation", () => {
  it("rejects end date earlier than start date", () => {
    const parsed = journeyUpdateSchema.safeParse({
      title: "Trip",
      slug: "trip",
      description: "A trip",
      startDate: "2026-04-10",
      endDate: "2026-04-09",
      status: "PLANNED",
      isPublic: true,
      coverImageUrl: "https://example.com/cover.jpg",
    });

    expect(parsed.success).toBe(false);
  });
});
