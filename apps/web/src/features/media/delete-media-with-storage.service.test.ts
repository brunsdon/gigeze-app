import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/utils/app-error";

const { mockPrisma, mockGetServerEnv, mockDeleteFile } = vi.hoisted(() => ({
  mockPrisma: {
    media: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockGetServerEnv: vi.fn(),
  mockDeleteFile: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: mockGetServerEnv,
}));

vi.mock("@/features/media/supabase-storage-service", () => ({
  SupabaseStorageService: class {
    deleteFile = mockDeleteFile;
  },
}));

import { deleteMediaWithStorage } from "@/features/media/service";

describe("deleteMediaWithStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue({ SUPABASE_STORAGE_BUCKET: "media" });
  });

  it("throws when media item does not exist", async () => {
    mockPrisma.media.findFirst.mockResolvedValue(null);

    await expect(deleteMediaWithStorage("missing", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "media-not-found", code: "MEDIA_NOT_FOUND" }),
    );

    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrisma.media.delete).not.toHaveBeenCalled();
  });

  it("throws when media storage path is missing", async () => {
    mockPrisma.media.findFirst.mockResolvedValue({ id: "media-1", filePath: "   " });

    await expect(deleteMediaWithStorage("media-1", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "media-storage-path-missing", code: "MEDIA_STORAGE_PATH_MISSING" }),
    );

    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrisma.media.delete).not.toHaveBeenCalled();
  });

  it("does not delete metadata when storage object is missing", async () => {
    mockPrisma.media.findFirst.mockResolvedValue({ id: "media-1", filePath: "Tours/photo.jpg" });
    mockDeleteFile.mockRejectedValue(new AppError("media-storage-object-missing", "MEDIA_STORAGE_OBJECT_MISSING"));

    await expect(deleteMediaWithStorage("media-1", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "media-storage-object-missing", code: "MEDIA_STORAGE_OBJECT_MISSING" }),
    );

    expect(mockDeleteFile).toHaveBeenCalledWith({ bucket: "media", filePath: "Tours/photo.jpg" });
    expect(mockPrisma.media.delete).not.toHaveBeenCalled();
  });

  it("does not delete metadata when storage deletion fails", async () => {
    mockPrisma.media.findFirst.mockResolvedValue({ id: "media-1", filePath: "Tours/photo.jpg" });
    mockDeleteFile.mockRejectedValue(new AppError("media-storage-delete-failed", "MEDIA_STORAGE_DELETE_FAILED"));

    await expect(deleteMediaWithStorage("media-1", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "media-storage-delete-failed", code: "MEDIA_STORAGE_DELETE_FAILED" }),
    );

    expect(mockDeleteFile).toHaveBeenCalledWith({ bucket: "media", filePath: "Tours/photo.jpg" });
    expect(mockPrisma.media.delete).not.toHaveBeenCalled();
  });

  it("deletes metadata only after storage deletion succeeds", async () => {
    const deletedRow = { id: "media-1" };

    mockPrisma.media.findFirst.mockResolvedValue({ id: "media-1", filePath: "Tours/photo.jpg" });
    mockDeleteFile.mockResolvedValue(undefined);
    mockPrisma.media.delete.mockResolvedValue(deletedRow);

    await expect(deleteMediaWithStorage("media-1", "workspace-1")).resolves.toEqual(deletedRow);

    expect(mockDeleteFile).toHaveBeenCalledWith({ bucket: "media", filePath: "Tours/photo.jpg" });
    expect(mockPrisma.media.delete).toHaveBeenCalledWith({ where: { id: "media-1" } });
  });
});
