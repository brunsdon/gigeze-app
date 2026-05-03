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
  mockUpdateJourney,
  mockDeleteJourney,
  mockSetJourneyActiveState,
  mockDuplicateJourney,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockUpdateJourney: vi.fn(),
  mockDeleteJourney: vi.fn(),
  mockSetJourneyActiveState: vi.fn(),
  mockDuplicateJourney: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/tours/service", () => ({
  createJourney: vi.fn(),
  updateJourney: mockUpdateJourney,
  deleteJourney: mockDeleteJourney,
  setJourneyActiveState: mockSetJourneyActiveState,
  duplicateJourney: mockDuplicateJourney,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  deleteJourneyAction,
  duplicateJourneyAction,
  setJourneyActiveStateAction,
  updateJourneyAction,
} from "@/features/tours/actions";

function buildJourneyFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("Tour actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({
      id: "workspace-1",
      defaultJourneyVisibility: "PRIVATE",
    });
  });

  it("redirects to success after update and revalidates relevant paths", async () => {
    mockUpdateJourney.mockResolvedValue({ id: "Tour-1" });

    const formData = buildJourneyFormData({
      journeyId: "Tour-1",
      title: "Test Tour",
      slug: "test-tour",
      description: "Desc",
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      status: "ACTIVE",
      coverImageUrl: "https://example.com/cover.jpg",
    });

    await expect(updateJourneyAction(formData)).rejects.toMatchObject({
      url: "/dashboard/tours/Tour-1?success=Tour-updated",
    });

    expect(mockUpdateJourney).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours/Tour-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours/Tour-1/edit");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/tours");
  });

  it("redirects with encoded error when Tour update fails", async () => {
    mockUpdateJourney.mockRejectedValue(new AppError("Tour-slug-conflict", "JOURNEY_SLUG_CONFLICT"));

    const formData = buildJourneyFormData({
      journeyId: "Tour-1",
      title: "Test Tour",
      slug: "test-tour",
      description: "Desc",
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      status: "ACTIVE",
      coverImageUrl: "https://example.com/cover.jpg",
    });

    await expect(updateJourneyAction(formData)).rejects.toMatchObject({
      url: "/dashboard/tours/Tour-1/edit?error=Tour-slug-conflict",
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("redirects with encoded error when Tour delete is blocked", async () => {
    mockDeleteJourney.mockRejectedValue(new AppError("Tour-has-dependent-records", "JOURNEY_HAS_DEPENDENCIES"));

    const formData = buildJourneyFormData({
      journeyId: "Tour-1",
    });

    await expect(deleteJourneyAction(formData)).rejects.toMatchObject({
      url: "/dashboard/tours/Tour-1?error=Tour-has-dependent-records",
    });

    expect(mockDeleteJourney).toHaveBeenCalledWith("Tour-1", "workspace-1");

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("keeps user on list page when setting active with returnTo", async () => {
    mockSetJourneyActiveState.mockResolvedValue({ id: "Tour-1", status: "ACTIVE" });

    const formData = buildJourneyFormData({
      journeyId: "Tour-1",
      makeActive: "true",
      returnTo: "/dashboard/tours",
    });

    await expect(setJourneyActiveStateAction(formData)).rejects.toMatchObject({
      url: "/dashboard/tours?success=Tour-status-updated",
    });

    expect(mockSetJourneyActiveState).toHaveBeenCalledWith("Tour-1", "workspace-1", true);
  });

  it("keeps user on list page when duplicating with returnTo", async () => {
    mockDuplicateJourney.mockResolvedValue({ id: "Tour-copy-1" });

    const formData = buildJourneyFormData({
      journeyId: "Tour-1",
      returnTo: "/dashboard/tours",
    });

    await expect(duplicateJourneyAction(formData)).rejects.toMatchObject({
      url: "/dashboard/tours?success=Tour-duplicated",
    });

    expect(mockDuplicateJourney).toHaveBeenCalledWith("Tour-1", {
      workspaceId: "workspace-1",
      userId: "user-1",
    });
  });

  it("uses Tour detail redirect when returnTo is not provided", async () => {
    mockSetJourneyActiveState.mockResolvedValue({ id: "Tour-1", status: "ACTIVE" });

    const formData = buildJourneyFormData({
      journeyId: "Tour-1",
      makeActive: "true",
    });

    await expect(setJourneyActiveStateAction(formData)).rejects.toMatchObject({
      url: "/dashboard/tours/Tour-1?success=Tour-status-updated",
    });
  });
});
