import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/utils/app-error";

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(url);
  }
}

const { mockRequireAuthenticatedUser, mockRequireWorkspaceOwner, mockDeleteMediaWithStorage, mockRedirect, mockRevalidatePath } = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockDeleteMediaWithStorage: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/media/service", () => ({
  createMediaMetadata: vi.fn(),
  updateMediaMetadata: vi.fn(),
  deleteMediaWithStorage: mockDeleteMediaWithStorage,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { deleteMediaAction } from "@/features/media/actions";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("deleteMediaAction storage lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
  });

  it("redirects with invalid-media-reference when mediaId is missing", async () => {
    await expect(deleteMediaAction(buildFormData({ mediaId: "" }))).rejects.toMatchObject({
      url: "/dashboard/media?error=invalid-media-reference",
    });

    expect(mockDeleteMediaWithStorage).not.toHaveBeenCalled();
  });

  it("redirects with storage missing-object error code", async () => {
    mockDeleteMediaWithStorage.mockRejectedValue(new AppError("media-storage-object-missing", "MEDIA_STORAGE_OBJECT_MISSING"));

    await expect(deleteMediaAction(buildFormData({ mediaId: "media-1" }))).rejects.toMatchObject({
      url: "/dashboard/media?error=media-storage-object-missing",
    });

    expect(mockDeleteMediaWithStorage).toHaveBeenCalledWith("media-1", "workspace-1");
  });

  it("redirects with storage delete failed error code", async () => {
    mockDeleteMediaWithStorage.mockRejectedValue(new AppError("media-storage-delete-failed", "MEDIA_STORAGE_DELETE_FAILED"));

    await expect(deleteMediaAction(buildFormData({ mediaId: "media-1" }))).rejects.toMatchObject({
      url: "/dashboard/media?error=media-storage-delete-failed",
    });

    expect(mockDeleteMediaWithStorage).toHaveBeenCalledWith("media-1", "workspace-1");
  });

  it("redirects with success and revalidates after safe deletion", async () => {
    mockDeleteMediaWithStorage.mockResolvedValue({ id: "media-1" });

    await expect(deleteMediaAction(buildFormData({ mediaId: "media-1" }))).rejects.toMatchObject({
      url: "/dashboard/media?success=media-deleted",
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
