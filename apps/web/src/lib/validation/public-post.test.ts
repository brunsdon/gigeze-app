import { describe, expect, it } from "vitest";
import { publicPostCreateSchema } from "@/lib/validation/public-post";

describe("public post validation", () => {
  it("rejects titles without letters or numbers", () => {
    const parsed = publicPostCreateSchema.safeParse({
      title: "!!!",
      content: "This is enough post body content for a valid length.",
      status: "DRAFT",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects non-http cover image URLs", () => {
    const parsed = publicPostCreateSchema.safeParse({
      title: "Road Update",
      content: "This is enough post body content for a valid length.",
      status: "DRAFT",
      coverImageUrl: "ftp://example.com/cover.jpg",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts https cover image URLs", () => {
    const parsed = publicPostCreateSchema.safeParse({
      title: "Road Update",
      content: "This is enough post body content for a valid length.",
      status: "DRAFT",
      coverImageUrl: "https://example.com/cover.jpg",
    });

    expect(parsed.success).toBe(true);
  });
});
