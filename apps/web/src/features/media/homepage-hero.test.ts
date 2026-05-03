import { describe, expect, it } from "vitest";
import { getHomepageHeroSlides } from "@/features/media/homepage-hero";
import type { PublicGalleryMediaItem } from "@/features/media/service";

function buildMediaItem(overrides: Partial<PublicGalleryMediaItem> = {}): PublicGalleryMediaItem {
  return {
    id: "media-1",
    filePath: "Tours/stage/photo.jpg",
    fileName: "photo.jpg",
    publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/stage/photo.jpg",
    mimeType: "image/jpeg",
    caption: "Golden hour",
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    createdByUser: {
      fullName: "Alex Driver",
      email: "alex@example.com",
    },
    workspace: {
      name: "Stage Crew",
      slug: "stage-crew",
    },
    Tour: {
      id: "Tour-1",
      title: "Coastal Run",
      slug: "coastal-run",
    },
    Gig: null,
    ...overrides,
  };
}

describe("getHomepageHeroSlides", () => {
  it("uses 'View Tour' CTA when a Tour is available", async () => {
    const slides = await getHomepageHeroSlides(null, [buildMediaItem()]);

    expect(slides[0]?.ctaLabel).toBe("View Tour");
    expect(slides[0]?.href).toBe("/Tours/coastal-run");
    expect(slides[0]?.title).toBe("Coastal Run");
  });

  it("uses 'Explore this moment' CTA when no Tour is available", async () => {
    const slides = await getHomepageHeroSlides(null, [
      buildMediaItem({
        Tour: null,
        caption: null,
        Gig: {
          id: "Gig-1",
          title: "Byron Bay",
          journeyId: "Tour-1",
        },
      }),
    ]);

    expect(slides[0]?.ctaLabel).toBe("Explore this moment");
    expect(slides[0]?.href).toBe("/gallery");
    expect(slides[0]?.title).toBe("Byron Bay");
  });

  it("retains fallback 'Read the story' CTA in padded slide set", async () => {
    const slides = await getHomepageHeroSlides({
      title: "Coastal Run",
      slug: "coastal-run",
      coverImageUrl: "https://images.example.com/cover.jpg",
      createdByUser: {
        fullName: "Alex Driver",
        email: "alex@example.com",
      },
      workspace: {
        name: "Stage Crew",
      },
    }, []);

    expect(slides).toHaveLength(3);
    expect(slides[0]?.ctaLabel).toBe("View Tour");
    expect(slides.some((slide) => slide.ctaLabel === "Read the story")).toBe(true);
  });
});
