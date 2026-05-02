import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockListJourneys, mockListMediaItems } = vi.hoisted(() => ({
  mockListJourneys: vi.fn(),
  mockListMediaItems: vi.fn(),
}));

const { mockRequireCurrentWorkspace } = vi.hoisted(() => ({
  mockRequireCurrentWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireCurrentWorkspace: mockRequireCurrentWorkspace,
}));

vi.mock("@/features/tours/service", () => ({
  listJourneys: mockListJourneys,
}));

vi.mock("@/features/media/service", () => ({
  listMediaItems: mockListMediaItems,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/forms/media-upload-form", () => ({
  MediaUploadForm: () => <div>Upload form mounted</div>,
}));

vi.mock("@/components/forms/action-submit-button", () => ({
  ActionSubmitButton: ({ label }: { label: string }) => <button type="submit">{label}</button>,
}));

vi.mock("@/components/forms/confirm-submit-button", () => ({
  ConfirmSubmitButton: ({ triggerLabel }: { triggerLabel: string }) => <button type="button">{triggerLabel}</button>,
}));

import MediaPage from "@/app/(app)/dashboard/media/page";

describe("dashboard media page smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentWorkspace.mockResolvedValue({ id: "workspace-1" });
  });

  it("renders upload form and media metadata visibility", async () => {
    mockListJourneys.mockResolvedValue([
      {
        id: "Tour-1",
        title: "NSW Coast Run",
        Gigs: [
          {
            id: "Gig-1",
            title: "Byron Bay",
          },
        ],
      },
    ]);
    mockListMediaItems.mockResolvedValue([
      {
        id: "media-1",
        fileName: "photo.jpg",
        caption: "Beach arrival",
        filePath: "Tours/nsw/photo.jpg",
        visibility: "PUBLIC",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        Tour: { id: "Tour-1", title: "NSW Coast Run" },
        Gig: { id: "Gig-1", title: "Byron Bay" },
      },
    ]);

    const element = await MediaPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Upload form mounted");
    expect(html).toContain("photo.jpg");
    expect(html).toContain("Beach arrival");
    expect(html).toContain("NSW Coast Run");
    expect(html).toContain("Byron Bay");
    expect(html).toContain('href="/dashboard/media/media-1/edit"');
  });
});
