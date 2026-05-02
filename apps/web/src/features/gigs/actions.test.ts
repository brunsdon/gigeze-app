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
  mockMoveStopUp,
  mockUpdateStop,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockMoveStopUp: vi.fn(),
  mockUpdateStop: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/gigs/service", () => ({
  createStop: vi.fn(),
  updateStop: mockUpdateStop,
  deleteStop: vi.fn(),
  moveStopUp: mockMoveStopUp,
  moveStopDown: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { moveStopUpAction, updateStopAction } from "@/features/gigs/actions";

function buildStopFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("Gig actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
  });

  it("redirects to success after moving Gig up", async () => {
    mockMoveStopUp.mockResolvedValue({ id: "Gig-1" });

    const formData = buildStopFormData({
      stopId: "Gig-1",
      journeyId: "Tour-1",
    });

    await expect(moveStopUpAction(formData)).rejects.toMatchObject({
      url: "/dashboard/Tours/Tour-1?success=Gig-order-updated",
    });

    expect(mockMoveStopUp).toHaveBeenCalledWith("Gig-1", "workspace-1");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/Tours/Tour-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/Tours/Tour-1");
  });

  it("redirects with invalid reference when required ids are missing", async () => {
    const formData = buildStopFormData({});

    await expect(moveStopUpAction(formData)).rejects.toMatchObject({
      url: "/dashboard/Tours?error=invalid-Gig-reference",
    });
  });

  it("redirects with encoded edit-page error when Gig update fails", async () => {
    mockUpdateStop.mockRejectedValue(new AppError("Gig-Tour-mismatch", "STOP_JOURNEY_MISMATCH"));

    const formData = buildStopFormData({
      stopId: "Gig-1",
      journeyId: "Tour-1",
      title: "Gig 1",
      description: "Desc",
      latitude: "-33.123",
      longitude: "151.123",
      locationName: "Byron Bay",
      arrivalDate: "2026-04-01",
      departureDate: "2026-04-02",
      status: "ACTIVE",
      orderIndex: "1",
    });

    await expect(updateStopAction(formData)).rejects.toMatchObject({
      url: "/dashboard/Tours/Tour-1/Gigs/Gig-1/edit?error=Gig-Tour-mismatch",
    });

    expect(mockUpdateStop).toHaveBeenCalledWith(
      "Gig-1",
      expect.objectContaining({
        journeyId: "Tour-1",
        title: "Gig 1",
      }),
      "workspace-1",
    );

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
