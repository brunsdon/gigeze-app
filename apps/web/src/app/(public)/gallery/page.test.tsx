import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockListPublicMediaItems, mockListPublicMediaFilterOptions } = vi.hoisted(() => ({
  mockListPublicMediaItems: vi.fn(),
  mockListPublicMediaFilterOptions: vi.fn(),
}));

vi.mock("@/features/media/service", () => ({
  listPublicMediaItems: mockListPublicMediaItems,
  listPublicMediaFilterOptions: mockListPublicMediaFilterOptions,
}));

vi.mock("@/components/gallery/public-media-grid", () => ({
  PublicMediaGrid: ({ items }: { items: Array<{ id: string }> }) => <div>Gallery grid: {items.length}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import PublicGalleryPage from "@/app/(public)/gallery/page";

describe("public gallery page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPublicMediaFilterOptions.mockResolvedValue({
      Tours: [{ id: "Tour-1", title: "Coast Run", slug: "coast-run" }],
      Gigs: [{ id: "Gig-1", title: "Byron Bay", journeyId: "Tour-1", journeyTitle: "Coast Run" }],
    });
  });

  it("renders the gallery grid and filters", async () => {
    mockListPublicMediaItems.mockResolvedValue([
      {
        id: "media-1",
        fileName: "coast.jpg",
        publicUrl: "https://example.com/coast.jpg",
        mimeType: "image/jpeg",
        caption: "Coastline",
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        Tour: { id: "Tour-1", title: "Coast Run", slug: "coast-run" },
        Gig: { id: "Gig-1", title: "Byron Bay", journeyId: "Tour-1" },
      },
    ]);

    const element = await PublicGalleryPage({
      searchParams: Promise.resolve({ Tour: "Tour-1", Gig: "Gig-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Gallery");
    expect(html).toContain("Moments captured on the road.");
    expect(html).toContain("Captured from real Tours tracked with GigEze.");
    expect(html).toContain("Filter media");
    expect(html).toContain("Gallery grid: 1");
    expect(html).toContain("Coast Run");
    expect(html).toContain("Byron Bay");
    expect(html).toContain("Track your trip");
    expect(html).toContain("Start your Tour -&gt;");
    expect(html).toContain('href="/gallery"');
  });

  it("renders a clean empty state when no public media exists", async () => {
    mockListPublicMediaItems.mockResolvedValue([]);

    const element = await PublicGalleryPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("No public media yet");
    expect(html).toContain("No gallery moments yet. Share your first trip photos and highlights will appear here.");
  });
});
