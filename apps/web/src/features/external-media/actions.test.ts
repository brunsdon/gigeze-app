import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalMediaEntityType } from "@prisma/client";
import { AppError } from "@/lib/utils/app-error";

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(url);
  }
}

const {
  mockRequireAuthenticatedUser,
  mockRequireWorkspaceOwner,
  mockCreateExternalMediaLink,
  mockUpdateExternalMediaLink,
  mockDeleteExternalMediaLink,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockCreateExternalMediaLink: vi.fn(),
  mockUpdateExternalMediaLink: vi.fn(),
  mockDeleteExternalMediaLink: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/external-media/service", () => ({
  createExternalMediaLink: mockCreateExternalMediaLink,
  updateExternalMediaLink: mockUpdateExternalMediaLink,
  deleteExternalMediaLink: mockDeleteExternalMediaLink,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  createExternalMediaLinkAction,
  deleteExternalMediaLinkAction,
  updateExternalMediaLinkAction,
} from "@/features/external-media/actions";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("external media actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
  });

  it("creates a link and redirects back to the Tour detail page", async () => {
    mockCreateExternalMediaLink.mockResolvedValue({ id: "link-1" });

    await expect(createExternalMediaLinkAction(buildFormData({
      entityType: ExternalMediaEntityType.Tour,
      entityId: "Tour-1",
      url: "https://youtu.be/dQw4w9WgXcQ",
      returnTo: "/dashboard/Tours/Tour-1",
    }))).rejects.toMatchObject({
      url: "/dashboard/Tours/Tour-1?success=external-media-linked",
    });

    expect(mockCreateExternalMediaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
      }),
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/Tours/Tour-1");
  });

  it("redirects with an encoded error when create fails", async () => {
    mockCreateExternalMediaLink.mockRejectedValue(new AppError("external-media-invalid-url", "EXTERNAL_MEDIA_INVALID_URL"));

    await expect(createExternalMediaLinkAction(buildFormData({
      entityType: ExternalMediaEntityType.Tour,
      entityId: "Tour-1",
      url: "bad-url",
      returnTo: "/dashboard/Tours/Tour-1",
    }))).rejects.toMatchObject({
      url: "/dashboard/Tours/Tour-1?error=external-media-invalid-url",
    });
  });

  it("updates link metadata", async () => {
    mockUpdateExternalMediaLink.mockResolvedValue({ id: "link-1" });

    await expect(updateExternalMediaLinkAction(buildFormData({
      linkId: "link-1",
      entityType: ExternalMediaEntityType.Tour,
      entityId: "Tour-1",
      title: "Updated title",
      caption: "Updated caption",
      returnTo: "/dashboard/Tours/Tour-1",
    }))).rejects.toMatchObject({
      url: "/dashboard/Tours/Tour-1?success=external-media-updated",
    });
  });

  it("soft deletes a link through the unlink action", async () => {
    mockDeleteExternalMediaLink.mockResolvedValue({ id: "link-1" });

    await expect(deleteExternalMediaLinkAction(buildFormData({
      linkId: "link-1",
      entityType: ExternalMediaEntityType.Tour,
      entityId: "Tour-1",
      returnTo: "/dashboard/Tours/Tour-1",
    }))).rejects.toMatchObject({
      url: "/dashboard/Tours/Tour-1?success=external-media-unlinked",
    });

    expect(mockDeleteExternalMediaLink).toHaveBeenCalledWith("link-1", "workspace-1");
  });
});
