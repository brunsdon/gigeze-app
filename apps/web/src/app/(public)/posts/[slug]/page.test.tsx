import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockGetPublishedPostBySlug, mockNotFound } = vi.hoisted(() => ({
  mockGetPublishedPostBySlug: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/features/posts/service", () => ({
  getPublishedPostBySlug: mockGetPublishedPostBySlug,
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import PublicPostDetailPage from "@/app/(public)/posts/[slug]/page";

describe("Public post detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when the post does not exist or is not published", async () => {
    mockGetPublishedPostBySlug.mockResolvedValue(null);

    await expect(PublicPostDetailPage({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NOT_FOUND");

    expect(mockGetPublishedPostBySlug).toHaveBeenCalledWith("missing");
  });

  it("renders the post and does not expose private linked Tour or Gig details", async () => {
    mockGetPublishedPostBySlug.mockResolvedValue({
      id: "post-1",
      slug: "quiet-venue",
      title: "Quiet Venue",
      excerpt: "A draft from the bush.",
      content: "Long-form public content for a published post.",
      coverImageUrl: "https://example.com/venue.jpg",
      publishedAt: new Date("2026-04-01T00:00:00.000Z"),
      Tour: null,
      Gig: null,
    });

    const element = await PublicPostDetailPage({ params: Promise.resolve({ slug: "quiet-venue" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Quiet Venue");
    expect(html).toContain("Quiet Venue cover image");
    expect(html).not.toContain("Private Tour");
    expect(html).not.toContain("Hidden Gig");
    expect(html).not.toContain("Tour context");
  });

  it("renders public linked Tour and Gig context when both are public", async () => {
    mockGetPublishedPostBySlug.mockResolvedValue({
      id: "post-2",
      slug: "beach-day",
      title: "Beach Day",
      excerpt: "Sunny update.",
      content: "Long-form public content for the beach day post.",
      coverImageUrl: undefined,
      publishedAt: new Date("2026-04-02T00:00:00.000Z"),
      Tour: {
        id: "Tour-2",
        title: "Coastal Run",
        slug: "coastal-run",
        isPublic: true,
      },
      Gig: {
        id: "Gig-2",
        title: "Main Beach",
        locationName: "Byron Bay",
        isPublic: true,
        journeyId: "Tour-2",
        Tour: {
          id: "Tour-2",
          slug: "coastal-run",
          isPublic: true,
        },
      },
    });

    const element = await PublicPostDetailPage({ params: Promise.resolve({ slug: "beach-day" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Tour context");
    expect(html).toContain("Coastal Run");
    expect(html).toContain("Main Beach");
    expect(html).toContain("Byron Bay");
    expect(html).toContain("Start tracking your own Tour -&gt;");
    expect(html).toContain("Build tour records");
    expect(html).toContain('href="/Tours/coastal-run"');
  });
});
