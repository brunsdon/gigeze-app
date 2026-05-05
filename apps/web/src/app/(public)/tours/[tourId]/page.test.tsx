import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockGetPublicJourneyByIdOrSlug, mockNotFound } = vi.hoisted(() => ({
  mockGetPublicJourneyByIdOrSlug: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

const { mockListPublicExternalMediaLinksForJourney } = vi.hoisted(() => ({
  mockListPublicExternalMediaLinksForJourney: vi.fn(),
}));

vi.mock("@/features/tours/service", () => ({
  getPublicJourneyByIdOrSlug: mockGetPublicJourneyByIdOrSlug,
}));

vi.mock("@/features/external-media/service", () => ({
  listPublicExternalMediaLinksForJourney: mockListPublicExternalMediaLinksForJourney,
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

import PublicJourneyDetailPage from "@/app/(public)/tours/[tourId]/page";

describe("Public Tour detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPublicExternalMediaLinksForJourney.mockResolvedValue([]);
  });

  it("calls notFound when Tour does not exist or is not public", async () => {
    mockGetPublicJourneyByIdOrSlug.mockResolvedValue(null);

    await expect(
      PublicJourneyDetailPage({ params: Promise.resolve({ tourId: "missing" }) }),
    ).rejects.toThrow("NOT_FOUND");

    expect(mockGetPublicJourneyByIdOrSlug).toHaveBeenCalledWith("missing");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("renders only data returned by the public service query", async () => {
    mockGetPublicJourneyByIdOrSlug.mockResolvedValue({
      id: "Tour-1",
      workspaceId: "workspace-1",
      slug: "coastal-run",
      title: "Coastal Run",
      description: "A public Tour",
      Gigs: [
        {
          id: "Gig-1",
          title: "Public Beach",
          locationName: "Byron Bay",
          latitude: 1.2345,
          longitude: 2.3456,
        },
      ],
    });

    const element = await PublicJourneyDetailPage({
      params: Promise.resolve({ tourId: "coastal-run" }),
    });
    const html = renderToStaticMarkup(element);

    expect(mockGetPublicJourneyByIdOrSlug).toHaveBeenCalledWith("coastal-run");
    expect(html).toContain("Coastal Run");
    expect(html).toContain("Public Beach");
    expect(html).toContain("Byron Bay");
    expect(html).toContain("Start tracking your own Tour -&gt;");
    expect(html).toContain("Build tour records");
  });
});
