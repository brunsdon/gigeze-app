import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import { moveStopDown, moveStopUp } from "@/features/gigs/service";

describe("Gigs service reordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not update ordering when moving the first Gig up", async () => {
    const tx = {
      gig: {
        findFirst: vi.fn().mockResolvedValue({ id: "Gig-1", journeyId: "Tour-1" }),
        findMany: vi.fn().mockResolvedValue([{ id: "Gig-1" }, { id: "Gig-2" }]),
        update: vi.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback: (arg: typeof tx) => unknown) => callback(tx));

    await moveStopUp("Gig-1", "workspace-1");

    expect(tx.gig.update).not.toHaveBeenCalled();
  });

  it("swaps and rewrites indexes when moving a Gig down", async () => {
    const tx = {
      gig: {
        findFirst: vi.fn().mockResolvedValue({ id: "Gig-1", journeyId: "Tour-1" }),
        findMany: vi.fn().mockResolvedValue([{ id: "Gig-1" }, { id: "Gig-2" }, { id: "Gig-3" }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback: (arg: typeof tx) => unknown) => callback(tx));

    await moveStopDown("Gig-1", "workspace-1");

    expect(tx.gig.update).toHaveBeenCalledTimes(3);
    expect(tx.gig.update).toHaveBeenNthCalledWith(1, {
      where: { id: "Gig-2" },
      data: { orderIndex: 1 },
    });
    expect(tx.gig.update).toHaveBeenNthCalledWith(2, {
      where: { id: "Gig-1" },
      data: { orderIndex: 2 },
    });
    expect(tx.gig.update).toHaveBeenNthCalledWith(3, {
      where: { id: "Gig-3" },
      data: { orderIndex: 3 },
    });
  });
});
