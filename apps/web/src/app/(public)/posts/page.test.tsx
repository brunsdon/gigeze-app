import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockListPublishedPosts } = vi.hoisted(() => ({
  mockListPublishedPosts: vi.fn(),
}));

vi.mock("@/features/posts/service", () => ({
  listPublishedPosts: mockListPublishedPosts,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import PublicPostsPage from "@/app/(public)/posts/page";

describe("Public posts page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an empty state when there are no published posts", async () => {
    mockListPublishedPosts.mockResolvedValue([]);

    const element = await PublicPostsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("No stories yet");
    expect(html).toContain("No stories yet. Publish your first road update and your journal will come alive.");
  });

  it("renders published post cards with slug links and cover image markup", async () => {
    mockListPublishedPosts.mockResolvedValue([
      {
        id: "post-1",
        slug: "coastal-update",
        title: "Coastal Update",
        excerpt: "Notes from the coast.",
        coverImageUrl: "https://example.com/coast.jpg",
        publishedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const element = await PublicPostsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Coastal Update");
    expect(html).toContain("Stories and highlights from real Tours.");
    expect(html).toContain("Start your Tour -&gt;");
    expect(html).toContain("Create your logbook");
    expect(html).toContain('href="/posts/coastal-update"');
    expect(html).toContain("Coastal Update cover image");
  });
});