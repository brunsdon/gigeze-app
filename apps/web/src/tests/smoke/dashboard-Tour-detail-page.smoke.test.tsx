import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockRequireCurrentWorkspace } = vi.hoisted(() => ({
  mockRequireCurrentWorkspace: vi.fn(),
}));

const { mockGetJourneyByIdOrSlug } = vi.hoisted(() => ({
  mockGetJourneyByIdOrSlug: vi.fn(),
}));

const { mockListExternalMediaLinksForJourneyMoments } = vi.hoisted(() => ({
  mockListExternalMediaLinksForJourneyMoments: vi.fn(),
}));

const { mockListActivityNotesForJourney } = vi.hoisted(() => ({
  mockListActivityNotesForJourney: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireCurrentWorkspace: mockRequireCurrentWorkspace,
}));

vi.mock("@/features/tours/service", () => ({
  getJourneyByIdOrSlug: mockGetJourneyByIdOrSlug,
}));

vi.mock("@/features/external-media/service", () => ({
  listExternalMediaLinksForJourneyMoments: mockListExternalMediaLinksForJourneyMoments,
}));

vi.mock("@/features/activity-notes/service", () => ({
  formatActivityDuration: () => null,
  getActivityTypeLabel: (type: string) =>
    ({ WORK: "Work", MAINTENANCE: "Maintenance", ADMIN: "Admin", PERSONAL: "Personal" })[type] ?? "Work",
  listActivityNotesForJourney: mockListActivityNotesForJourney,
}));

vi.mock("@/features/maps/service", () => ({
  mapJourneyToMapData: vi.fn(() => ({
    id: "Tour-1",
    title: "Timeline Test",
    markers: [],
  })),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/maps/map-boundary", () => ({
  MapBoundary: () => <div>Map boundary</div>,
}));

vi.mock("@/components/forms/action-submit-button", () => ({
  ActionSubmitButton: ({ label }: { label: string }) => <button type="submit">{label}</button>,
}));

vi.mock("@/components/forms/confirm-submit-button", () => ({
  ConfirmSubmitButton: ({ triggerLabel }: { triggerLabel: string }) => <button type="button">{triggerLabel}</button>,
}));

import DashboardJourneyDetailPage from "@/app/(app)/dashboard/tours/[tourId]/page";

describe("dashboard Tour detail timeline smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentWorkspace.mockResolvedValue({ id: "workspace-1" });
    mockListExternalMediaLinksForJourneyMoments.mockResolvedValue([]);
    mockListActivityNotesForJourney.mockResolvedValue([]);
  });

  it("renders timeline in orderIndex order, not chronological date order", async () => {
    mockGetJourneyByIdOrSlug.mockResolvedValue({
      id: "Tour-1",
      slug: "timeline-test",
      title: "Timeline Test",
      description: "Testing move order",
      status: "PLANNED",
      visibility: "PRIVATE",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: null,
      coverImageUrl: null,
      Gigs: [
        {
          id: "Gig-2",
          title: "Second by order",
          locationName: "B",
          orderIndex: 2,
          latitude: -35.0,
          longitude: 149.0,
          arrivalDate: new Date("2026-04-01T00:00:00.000Z"),
          departureDate: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          description: null,
          visibility: "PRIVATE",
        },
        {
          id: "Gig-1",
          title: "First by order",
          locationName: "A",
          orderIndex: 1,
          latitude: -34.0,
          longitude: 151.0,
          arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
          departureDate: null,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          description: null,
          visibility: "PRIVATE",
        },
      ],
      mediaItems: [],
      drivingLogs: [],
      activityNotes: [],
    });

    const element = await DashboardJourneyDetailPage({
      params: Promise.resolve({ journeyId: "Tour-1" }),
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(element);
    const firstIndex = html.indexOf("First by order");
    const secondIndex = html.indexOf("Second by order");

    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeLessThan(secondIndex);
    expect(html).toContain("Activity");
    expect(html).toContain("/dashboard/activity?journeyId=Tour-1");
  });
});
