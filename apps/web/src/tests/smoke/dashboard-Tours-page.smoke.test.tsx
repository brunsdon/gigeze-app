import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockRequireCurrentWorkspace } = vi.hoisted(() => ({
  mockRequireCurrentWorkspace: vi.fn(),
}));

const { mockListJourneys } = vi.hoisted(() => ({
  mockListJourneys: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireCurrentWorkspace: mockRequireCurrentWorkspace,
}));

vi.mock("@/features/tours/service", () => ({
  listJourneys: mockListJourneys,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/forms/action-submit-button", () => ({
  ActionSubmitButton: ({ label }: { label: string }) => <button type="submit">{label}</button>,
}));

import DashboardJourneysPage from "@/app/(app)/dashboard/tours/page";

describe("dashboard Tours page smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentWorkspace.mockResolvedValue({ id: "workspace-1" });
  });

  it("renders Tour tile forms that post back to the Tours list", async () => {
    mockListJourneys.mockResolvedValue([
      {
        id: "Tour-1",
        title: "Tasmania Loop",
        description: "South island run",
        status: "ACTIVE",
        visibility: "PUBLIC",
        Gigs: [{ id: "Gig-1" }],
      },
      {
        id: "Tour-2",
        title: "Nullarbor Sprint",
        description: null,
        status: "PLANNED",
        visibility: "PRIVATE",
        Gigs: [],
      },
    ]);

    const element = await DashboardJourneysPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Tasmania Loop");
    expect(html).toContain("Nullarbor Sprint");
    expect(html).toContain("Clear active");
    expect(html).toContain("Set active");
    expect(html).toContain("Duplicate");

    // Two Tours x two forms each should include returnTo on all tile actions.
    const returnToMatches = html.match(/name="returnTo" value="\/dashboard\/Tours"/g) ?? [];
    expect(returnToMatches).toHaveLength(4);
  });
});
