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
        publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/coastal-run/sunrise.jpg",
        mimeType: "image/jpeg",
        caption: "Sunrise camp",
        createdAt: new Date("2026-03-03T10:00:00.000Z"),
        createdByUser: {
          fullName: "Alex Driver",
          email: "alex@example.com",
        },
        workspace: {
          name: "Road Crew",
          slug: "road-crew",
        },
        Tour: { id: "Tour-1", title: "Coastal Run", slug: "coastal-run" },
        Gig: null,
      },
    ]);

    const element = await PublicHomePage();
    const html = renderToStaticMarkup(element);

    expect(mockListPublicJourneys).toHaveBeenCalledTimes(1);
    expect(mockListLatestPublishedPosts).toHaveBeenCalledWith(3);
    expect(mockListPublicMediaItems).toHaveBeenCalledTimes(1);
    expect(html).toContain("Capture life on the road");
    expect(html).toContain("Track your Tours, relive your moments, and keep your trip records in one place.");
    expect(html).toContain("Built for tour logistics across Australia.");
    expect(html).toContain("Automatic trip tracking. No paperwork.");
    expect(html).toContain("Never manually track your logbook again.");
    expect(html).toContain("Explore Tours");
    expect(html).toContain("Start your Tour");
    expect(html).toContain("Trips tracked automatically");
    expect(html).toContain("Logs kept accurate");
    expect(html).toContain("Export when you need it");
    expect(html).toContain("Track your trip");
    expect(html).toContain("Create your logbook");
    expect(html).toContain("From the road");
    expect(html).toContain("Real Tours and stories shared from across Australia.");
    expect(html).toContain("Start your own Tour");
    expect(html).toContain("Keep your travels, stories, and trip records together in one place.");
    expect(html).toContain("Start your Tour");
    expect(html).toContain("Featured moment from the road");
    expect(html).toContain("Previous featured moment");
    expect(html).toContain("Next featured moment");
    expect(html).toContain("Coastal Run");
    expect(html).toContain("Coastal Update");
    expect(html).toContain('href="/Tours/coastal-run"');
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
    expect(html).toContain('href="/dashboard/Tours/Tour-active"');
  });
});