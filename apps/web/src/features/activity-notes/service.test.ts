import { ActivityType, Visibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    activityNote: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tour: {
      findFirst: vi.fn(),
    },
    gig: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import { createActivityNote, deleteActivityNote, updateActivityNote } from "@/features/activity-notes/service";

const validInput = {
  journeyId: "Tour-1",
  stopId: undefined,
  type: ActivityType.WORK,
  date: new Date("2026-04-01"),
  durationMinutes: 90,
  location: "Camp",
  notes: "Client call",
  visibility: Visibility.PRIVATE,
};

describe("activity notes service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an activity note with required type and Tour", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.activityNote.create.mockResolvedValue({ id: "note-1" });

    await createActivityNote(validInput, { workspaceId: "workspace-1", userId: "user-1" });

    expect(mockPrisma.activityNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdByUserId: "user-1",
        journeyId: "Tour-1",
        type: ActivityType.WORK,
        durationMinutes: 90,
      }),
    });
  });

  it("rejects a Gig from another Tour", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.gig.findFirst.mockResolvedValue({ id: "Gig-1", journeyId: "Tour-2" });

    await expect(
      createActivityNote(
        {
          ...validInput,
          stopId: "Gig-1",
        },
        { workspaceId: "workspace-1", userId: "user-1" },
      ),
    ).rejects.toEqual(expect.objectContaining({ message: "activity-note-Gig-Tour-mismatch" }));

    expect(mockPrisma.activityNote.create).not.toHaveBeenCalled();
  });

  it("throws when updating a missing note", async () => {
    mockPrisma.activityNote.findFirst.mockResolvedValue(null);

    await expect(updateActivityNote("missing", validInput, "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "activity-note-not-found", code: "ACTIVITY_NOTE_NOT_FOUND" }),
    );

    expect(mockPrisma.activityNote.update).not.toHaveBeenCalled();
  });

  it("throws when deleting a missing note", async () => {
    mockPrisma.activityNote.findFirst.mockResolvedValue(null);

    await expect(deleteActivityNote("missing", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "activity-note-not-found", code: "ACTIVITY_NOTE_NOT_FOUND" }),
    );

    expect(mockPrisma.activityNote.delete).not.toHaveBeenCalled();
  });
});
