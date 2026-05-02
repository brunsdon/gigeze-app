import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExternalMediaEntityType, ExternalMediaPlatform } from "@prisma/client";
import { PublicMomentCards } from "@/components/external-media/public-moment-cards";
import type { ExternalMediaLinkRecord } from "@/features/external-media/service";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function buildLink(overrides: Partial<ExternalMediaLinkRecord>): ExternalMediaLinkRecord {
  return {
    id: "link-1",
    entityType: ExternalMediaEntityType.Tour,
    entityId: "Tour-1",
    url: "https://www.flickr.com/photos/example/123/",
    platform: ExternalMediaPlatform.FLICKR,
    title: null,
    caption: null,
    thumbnailUrl: null,
    embedUrl: null,
    externalId: null,
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
    updatedAt: new Date("2026-04-24T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PublicMomentCards", () => {
  it("renders hosted thumbnails as background cards instead of image elements", () => {
    const html = renderToStaticMarkup(
      <PublicMomentCards
        title="Tour moments"
        links={[buildLink({
          title: "River camp",
          thumbnailUrl: "https://live.staticflickr.com/example/river_b.jpg",
        })]}
      />,
    );

    expect(html).toContain("River camp");
    expect(html).toContain("background-image:url(https://live.staticflickr.com/example/river_b.jpg)");
    expect(html).not.toContain("<img");
  });

  it("renders a friendly missing-thumbnail fallback", () => {
    const html = renderToStaticMarkup(
      <PublicMomentCards title="Tour moments" links={[buildLink({ title: "Photo Gig" })]} />,
    );

    expect(html).toContain("Photo Gig");
    expect(html).toContain("Open this moment");
    expect(html).not.toContain("<img");
  });
});
