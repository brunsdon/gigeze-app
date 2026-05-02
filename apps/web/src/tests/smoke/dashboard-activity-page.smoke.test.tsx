import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockRequireCurrentWorkspace } = vi.hoisted(() => ({
  mockRequireCurrentWorkspace: vi.fn(),
}));

const { mockListJourneys } = vi.hoisted(() => ({
  mockListJourneys: vi.fn(),
}));

const { mockListActivityNotes } = vi.hoisted(() => ({
  mockListActivityNotes: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireCurrentWorkspace: mockRequireCurrentWorkspace,
}));

vi.mock("@/features/tours/service", () => ({
  listJourneys: mockListJourneys,
}));

vi.mock("@/features/activity-notes/service", () => ({
  formatActivityDuration: () => null,
  getActivityTypeLabel: () => "Work",
  listActivityNotes: mockListActivityNotes,
}));

vi.mock("@/components/forms/action-submit-button", () => ({
  ActionSubmitButton: ({ label }: { label: string }) => <button type="submit">{label}</button>,
}));

import ActivityPage from "@/app/(app)/dashboard/activity/page";

describe("dashboard activity page", () => {
  it("uses Activity wording", async () => {
    mockRequireCurrentWorkspace.mockResolvedValue({ id: "workspace-1" });
    mockListJourneys.mockResolvedValue([
      {
        id: "Tour-1",
        title: "Coast run",
        status: "ACTIVE",
        Gigs: [],
      },
    ]);
    mockListActivityNotes.mockResolvedValue([]);

    const element = await ActivityPage({
      searchParams: Promise.resolve({ journeyId: "Tour-1" }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Activity on the road");
    expect(html).toContain("Capture work, maintenance, admin, and personal notes alongside your travel timeline.");
    expect(html).toContain("Add activity");
    expect(html).toContain("Save activity");
    expect(html).toContain("Recent activity");
    expect(html).toContain("No activity notes yet");
  });
});
