import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockListPublicJourneys, mockListJourneys, mockListLatestPublishedPosts, mockListPublicMediaItems } = vi.hoisted(() => ({
  mockListPublicJourneys: vi.fn(),
  mockListJourneys: vi.fn(),
  mockListLatestPublishedPosts: vi.fn(),
  mockListPublicMediaItems: vi.fn(),
}));

const { mockGetCurrentUser, mockGetCurrentWorkspaceForUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentWorkspaceForUser: vi.fn(),
}));

vi.mock("@/features/tours/service", () => ({
  listPublicJourneys: mockListPublicJourneys,
  listJourneys: mockListJourneys,
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentUser: mockGetCurrentUser,
  getCurrentWorkspaceForUser: mockGetCurrentWorkspaceForUser,
}));

vi.mock("@/features/posts/service", () => ({
  listLatestPublishedPosts: mockListLatestPublishedPosts,
}));

vi.mock("@/features/media/service", () => ({
  listPublicMediaItems: mockListPublicMediaItems,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import PublicHomePage from "@/app/(public)/page";

describe("Public home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetCurrentWorkspaceForUser.mockResolvedValue(null);
    mockListJourneys.mockResolvedValue([]);
  });

  it("renders latest public Tours and latest stories", async () => {
    mockListPublicJourneys.mockResolvedValue([
      {
        id: "Tour-1",
        slug: "coastal-run",
        title: "Coastal Run",
        description: "A public route",
        status: "ACTIVE",
        Gigs: [
          {
            id: "Gig-1",
            title: "Byron Bay",
            locationName: "Byron Bay",
            orderIndex: 1,
            latitude: -28.6474,
            longitude: 153.602,
            createdAt: new Date("2026-03-01T10:00:00.000Z"),
          },
        ],
      },
    ]);
    mockListLatestPublishedPosts.mockResolvedValue([
      {
        id: "post-1",
        slug: "coastal-update",
        title: "Coastal Update",
        excerpt: "Notes from the coast.",
        updatedAt: new Date("2026-03-02T10:00:00.000Z"),
        publishedAt: new Date("2026-03-02T10:00:00.000Z"),
      },
    ]);
    mockListPublicMediaItems.mockResolvedValue([
      {
        id: "media-1",
        filePath: "Tours/coastal-run/sunrise.jpg",
        fileName: "byron.jpg",
        publicUrl: "https://project.supabase.co/storage/v1/object/public/media/tours/coastal-run/sunrise.jpg",
        mimeType: "image/jpeg",
        caption: "Soundcheck lights",
        createdAt: new Date("2026-03-03T10:00:00.000Z"),
        createdByUser: {
          fullName: "Alex Driver",
          email: "alex@example.com",
        },
        workspace: {
          name: "Stage Crew",
          slug: "stage-crew",
        },
        Tour: { id: "Tour-1", title: "Coastal Run", slug: "coastal-run" },
        Gig: null,
      },
    ]);

    const element = await PublicHomePage();
    const html = renderToStaticMarkup(element);

    expect(mockListPublicJourneys).toHaveBeenCalledTimes(1);
    expect(mockListLatestPublishedPosts).toHaveBeenCalledWith(3);
    expect(mockListPublicMediaItems).not.toHaveBeenCalled();
    expect(html).toContain("Run the tour like a headliner");
    expect(html).toContain("Plan tours, manage gigs, capture field activity, and keep media, notes, and trip sync in one backstage-ready workspace.");
    expect(html).toContain("Venues. Gigs. Activity notes. Tour records.");
    expect(html).toContain("Built for tour managers who need the show details without the spreadsheet scramble.");
    expect(html).toContain("All Access");
    expect(html).toContain("Tours");
    expect(html).toContain("Gigs");
    expect(html).toContain("Venues");
    expect(html).toContain("Media");
    expect(html).toContain("Backstage operations, one setlist");
    expect(html).toContain("Explore Tours");
    expect(html).toContain("Open Backstage");
    expect(html).toContain("Gigs tracked automatically");
    expect(html).toContain("Notes stay show-ready");
    expect(html).toContain("Media ready to publish");
    expect(html).toContain("Capture field activity");
    expect(html).toContain("Build tour records");
    expect(html).toContain("Backstage feed");
    expect(html).toContain("Published tours, gig notes, and media from the GigEze community.");
    expect(html).toContain("Get the tour out of the group chat");
    expect(html).toContain("Keep gigs, venues, activity notes, media, and trip records together in one tour-management workspace.");
    expect(html).toContain("Start a Tour");
    expect(html).toContain("Backstage telemetry");
    expect(html).toContain("LIVE");
    expect(html).toContain("Field Capture");
    expect(html).toContain("Coastal Run");
    expect(html).toContain("Coastal Update");
    expect(html).toContain('href="/tours/coastal-run"');
    expect(html).toContain('href="/posts/coastal-update"');
  });

  it("renders personalized greeting and continue shortcut for authenticated user", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      fullName: "Alex Driver",
      supabaseAuthUserId: "auth-1",
    });

    mockGetCurrentWorkspaceForUser.mockResolvedValue({
      id: "workspace-1",
      slug: "alex-workspace",
      name: "Alex Workspace",
      description: null,
      ownerUserId: "user-1",
      defaultJourneyVisibility: "PRIVATE",
      defaultPostVisibility: "PRIVATE",
      defaultMediaVisibility: "PRIVATE",
      role: "OWNER",
    });

    mockListJourneys.mockResolvedValue([
      {
        id: "Tour-active",
        slug: "nsw-loop",
        title: "NSW Loop",
        status: "ACTIVE",
        Gigs: [],
      },
    ]);

    mockListPublicJourneys.mockResolvedValue([]);
    mockListLatestPublishedPosts.mockResolvedValue([]);
    mockListPublicMediaItems.mockResolvedValue([]);

    const element = await PublicHomePage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Welcome back, Alex Driver");
    expect(html).toContain("Continue your Tour");
    expect(html).toContain("No backstage updates yet");
    expect(html).toContain("Tours, gig notes, media, and stories will appear here once published.");
    expect(html).toContain('href="/dashboard/tours/Tour-active"');
  });
});
