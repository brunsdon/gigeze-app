import { ActivityType, Visibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/utils/app-error";

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(url);
  }
}

const {
  mockRequireAuthenticatedUser,
  mockRequireWorkspaceOwner,
  mockUpdateActivityNote,
  mockDeleteActivityNote,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockUpdateActivityNote: vi.fn(),
  mockDeleteActivityNote: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/activity-notes/service", () => ({
  createActivityNote: vi.fn(),
  updateActivityNote: mockUpdateActivityNote,
  deleteActivityNote: mockDeleteActivityNote,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { deleteActivityNoteAction, updateActivityNoteAction } from "@/features/activity-notes/actions";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("activity note actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
  });

  it("redirects to success after update", async () => {
    mockUpdateActivityNote.mockResolvedValue({ id: "note-1" });

    await expect(
      updateActivityNoteAction(
        buildFormData({
          noteId: "note-1",
          journeyId: "Tour-1",
          type: ActivityType.MAINTENANCE,
          date: "2026-04-01",
          durationMinutes: "45",
          visibility: Visibility.PRIVATE,
          location: "Camp",
          notes: "",
        }),
      ),
    ).rejects.toMatchObject({ url: "/dashboard/activity?success=activity-note-updated" });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/activity");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours/Tour-1");
  });

  it("redirects with encoded service error on delete", async () => {
    mockDeleteActivityNote.mockRejectedValue(new AppError("activity-note-not-found", "ACTIVITY_NOTE_NOT_FOUND"));

    await expect(deleteActivityNoteAction(buildFormData({ noteId: "note-1" }))).rejects.toMatchObject({
      url: "/dashboard/activity?error=activity-note-not-found",
    });

    expect(mockDeleteActivityNote).toHaveBeenCalledWith("note-1", "workspace-1");
  });
});
