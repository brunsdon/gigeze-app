import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPublicJourneyByIdOrSlug } = vi.hoisted(() => ({
  mockGetPublicJourneyByIdOrSlug: vi.fn(),
}));

vi.mock("@/features/tours/service", () => ({
  getPublicJourneyByIdOrSlug: mockGetPublicJourneyByIdOrSlug,
}));

import { generateMetadata } from "@/app/(public)/tours/[tourId]/story/page";

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

describe("Public Tour story metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not-found metadata when Tour is missing", async () => {
    mockGetPublicJourneyByIdOrSlug.mockResolvedValue(null);

    const metadata = await generateMetadata({ params: Promise.resolve({ tourId: "missing" }) });

    expect(metadata.title).toBe("Tour story not found | GigEze");
  });

  it("uses hero media for social preview when available", async () => {
    mockGetPublicJourneyByIdOrSlug.mockResolvedValue({
      id: "Tour-1",
      slug: "coastal-run",
      title: "Coastal Run",
      description: "A public coastal trip.",
      coverImageUrl: "https://example.com/cover.jpg",
      Gigs: [
        {
          id: "Gig-1",
          title: "Byron Bay",
          orderIndex: 1,
          arrivalDate: new Date("2026-04-01T10:00:00.000Z"),
          departureDate: null,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
        },
      ],
      mediaItems: [
        {
          id: "media-1",
          stopId: "Gig-1",
          publicUrl: "https://example.com/hero.jpg",
          caption: "Sunset at the bay",
          createdAt: new Date("2026-04-01T12:00:00.000Z"),
        },
      ],
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ tourId: "coastal-run" }) });
    const openGraphImages = toArray(metadata.openGraph?.images);
    const twitterImages = toArray(metadata.twitter?.images);

    expect(openGraphImages[0]).toMatchObject({
      url: "https://example.com/hero.jpg",
      alt: "Sunset at the bay",
    });
    expect(twitterImages[0]).toBe("https://example.com/hero.jpg");
  });

  it("falls back to cover image and then default OG image", async () => {
    mockGetPublicJourneyByIdOrSlug.mockResolvedValueOnce({
      id: "Tour-2",
      slug: "inland-run",
      title: "Inland Run",
      description: "A public inland trip.",
      coverImageUrl: "https://example.com/inland-cover.jpg",
      Gigs: [],
      mediaItems: [],
    });

    const withCover = await generateMetadata({ params: Promise.resolve({ tourId: "inland-run" }) });
    const withCoverImages = toArray(withCover.openGraph?.images);
    expect(withCoverImages[0]).toMatchObject({
      url: "https://example.com/inland-cover.jpg",
    });

    mockGetPublicJourneyByIdOrSlug.mockResolvedValueOnce({
      id: "Tour-3",
      slug: "empty-run",
      title: "Empty Run",
      description: null,
      coverImageUrl: null,
      Gigs: [],
      mediaItems: [],
    });

    const noMediaOrCover = await generateMetadata({ params: Promise.resolve({ tourId: "empty-run" }) });
    const noMediaOpenGraphImages = toArray(noMediaOrCover.openGraph?.images);
    const noMediaTwitterImages = toArray(noMediaOrCover.twitter?.images);

    expect(noMediaOpenGraphImages[0]).toMatchObject({
      url: "/og-image.svg",
    });
    expect(noMediaTwitterImages[0]).toBe("/og-image.svg");
  });
});
