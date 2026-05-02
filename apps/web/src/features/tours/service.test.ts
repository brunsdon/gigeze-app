import { describe, expect, it, beforeEach, vi } from "vitest";
import { JourneyStatus } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    tour: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    externalMediaLink: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import { deleteJourney, updateJourney } from "@/features/tours/service";

const validJourneyUpdateInput = {
  title: "Updated Tour",
  slug: "updated-Tour",
  description: "Updated description",
  startDate: new Date("2026-03-01"),
  endDate: new Date("2026-03-07"),
  status: JourneyStatus.ACTIVE,
  visibility: "PUBLIC" as const,
  coverImageUrl: "https://example.com/cover.jpg",
};

describe("Tours service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  });

  it("throws on slug collision when updating a Tour", async () => {
    mockPrisma.tour.findFirst.mockResolvedValueOnce({ id: "Tour-1" });
    mockPrisma.tour.findUnique.mockResolvedValueOnce({ id: "Tour-2" });

    await expect(updateJourney("Tour-1", validJourneyUpdateInput, { workspaceId: "workspace-1" })).rejects.toEqual(
      expect.objectContaining({ message: "Tour-slug-conflict", code: "JOURNEY_SLUG_CONFLICT" }),
    );

    expect(mockPrisma.tour.update).not.toHaveBeenCalled();
  });

  it("blocks deleting a Tour with dependent records", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({
      id: "Tour-1",
      _count: {
        drivingLogs: 1,
        activityNotes: 0,
        mediaItems: 0,
      },
    });

    await expect(deleteJourney("Tour-1", "workspace-1")).rejects.toEqual(
      expect.objectContaining({
        message: "Tour-has-dependent-records",
        code: "JOURNEY_HAS_DEPENDENCIES",
      }),
    );

    expect(mockPrisma.tour.delete).not.toHaveBeenCalled();
  });

  it("deletes Tour when no dependent records exist", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({
      id: "Tour-1",
      _count: {
        drivingLogs: 0,
        activityNotes: 0,
        mediaItems: 0,
      },
    });
    mockPrisma.externalMediaLink.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.tour.delete.mockResolvedValue({ id: "Tour-1" });

    await deleteJourney("Tour-1", "workspace-1");

    expect(mockPrisma.tour.delete).toHaveBeenCalledWith({ where: { id: "Tour-1" } });
    expect(mockPrisma.externalMediaLink.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        entityType: "Tour",
        entityId: "Tour-1",
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
  });
});
