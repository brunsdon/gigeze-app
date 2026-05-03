import type { ReactNode } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockListPublicJourneys } = vi.hoisted(() => ({
  mockListPublicJourneys: vi.fn(),
}));

vi.mock("@/features/tours/service", () => ({
  listPublicJourneys: mockListPublicJourneys,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import PublicJourneysPage from "@/app/(public)/tours/page";

describe("Public Tours page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders public Tours list using slug links", async () => {
    mockListPublicJourneys.mockResolvedValue([
      {
        id: "Tour-1",
        slug: "coastal-run",
        title: "Coastal Run",
        description: "A public route",
        status: "ACTIVE",
        Gigs: [{ id: "Gig-1" }, { id: "Gig-2" }],
      },
    ]);

    const element = await PublicJourneysPage();
    const html = renderToStaticMarkup(element);

    expect(mockListPublicJourneys).toHaveBeenCalledTimes(1);
    expect(html).toContain("Coastal Run");
    expect(html).toContain("2 public Gigs");
    expect(html).toContain("Explore tours shared by crews, artists, and tour managers.");
    expect(html).toContain("Each tour can connect gigs, venues, media, notes, and trip sync.");
    expect(html).toContain("Start your Tour -&gt;");
    expect(html).toContain("Build tour records");
    expect(html).toContain('href="/tours/coastal-run"');
  });
});
