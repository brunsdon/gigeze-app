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
  mockUpdateMediaMetadata,
  mockDeleteMediaWithStorage,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockUpdateMediaMetadata: vi.fn(),
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
  updateMediaMetadata: mockUpdateMediaMetadata,
  deleteMediaWithStorage: mockDeleteMediaWithStorage,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { deleteMediaAction, updateMediaMetadataAction } from "@/features/media/actions";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("media actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1", defaultMediaVisibility: "PRIVATE" });
  });

  it("redirects to success after metadata update", async () => {
    mockUpdateMediaMetadata.mockResolvedValue({ id: "media-1" });

    await expect(
      updateMediaMetadataAction(
        buildFormData({
          mediaId: "media-1",
          filePath: "Tours/a/photo.jpg",
          fileName: "photo.jpg",
          publicUrl: "",
          mimeType: "image/jpeg",
          sizeBytes: "123",
          caption: "",
        }),
      ),
    ).rejects.toMatchObject({ url: "/dashboard/media?success=media-updated" });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects with encoded service error on delete", async () => {
    mockDeleteMediaWithStorage.mockRejectedValue(new AppError("media-not-found", "MEDIA_NOT_FOUND"));

    await expect(deleteMediaAction(buildFormData({ mediaId: "media-1" }))).rejects.toMatchObject({
      url: "/dashboard/media?error=media-not-found",
    });

    expect(mockDeleteMediaWithStorage).toHaveBeenCalledWith("media-1", "workspace-1");
  });
});