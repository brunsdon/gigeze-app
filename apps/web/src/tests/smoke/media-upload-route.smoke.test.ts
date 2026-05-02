import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_FILE_SIZE_BYTES,
  MEDIA_UPLOAD_MESSAGES,
} from "@/features/media/upload-limits";

const {
  mockRequireAuthenticatedUser,
  mockRequireWorkspaceOwner,
  mockCreateMediaMetadata,
  mockGetServerEnv,
  mockIsEnvConfigError,
  mockUploadFile,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockCreateMediaMetadata: vi.fn(),
  mockGetServerEnv: vi.fn(),
  mockIsEnvConfigError: vi.fn(),
  mockUploadFile: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/media/service", () => ({
  createMediaMetadata: mockCreateMediaMetadata,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: mockGetServerEnv,
  isEnvConfigError: mockIsEnvConfigError,
}));

vi.mock("@/features/media/supabase-storage-service", () => ({
  SupabaseStorageService: class {
    uploadFile = mockUploadFile;
  },
}));

import { POST } from "@/app/api/media/upload/route";

describe("media upload route smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
    mockGetServerEnv.mockReturnValue({
      SUPABASE_STORAGE_BUCKET: "media",
    });
    mockIsEnvConfigError.mockReturnValue(false);
  });

  it("uploads file and creates metadata record", async () => {
    mockUploadFile.mockResolvedValue({
      filePath: "Tours/nsw-coast-run/photo.jpg",
      publicUrl: "https://example.com/photo.jpg",
    });
    mockCreateMediaMetadata.mockResolvedValue({ id: "media-1" });

    const formData = new FormData();
    formData.set("file", new File(["hello"], "photo.jpg", { type: "image/jpeg" }));
    formData.set("journeyId", "Tour-1");
    formData.set("caption", "Beach arrival");
    formData.set("visibility", "PUBLIC");

    const request = new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = (await response.json()) as { media: { id: string } };

    expect(response.status).toBe(201);
    expect(body.media.id).toBe("media-1");
    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockCreateMediaMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "photo.jpg",
        caption: "Beach arrival",
        visibility: "PUBLIC",
      }),
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
      }),
    );
  });

  it("returns 400 when file is missing", async () => {
    const request = new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: new FormData(),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("File is required");
  });

  it("returns 400 when mime type is not allowed", async () => {
    const formData = new FormData();
    formData.set("file", new File(["hello"], "document.pdf", { type: "application/pdf" }));

    const request = new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(MEDIA_UPLOAD_MESSAGES.imagesOnly);
    expect(body.code).toBe("INVALID_MIME_TYPE");
  });

  it("returns 400 when video uploads are disabled", async () => {
    const formData = new FormData();
    formData.set("file", new File(["hello"], "clip.mp4", { type: "video/mp4" }));

    const request = new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(MEDIA_UPLOAD_MESSAGES.videoDisabled);
    expect(body.code).toBe("VIDEO_DISABLED");
  });

  it("returns 400 when file exceeds max file size", async () => {
    const oversized = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
    const formData = new FormData();
    formData.set("file", new File([oversized], "large-photo.jpg", { type: "image/jpeg" }));

    const request = new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(MEDIA_UPLOAD_MESSAGES.fileTooLarge);
    expect(body.code).toBe("FILE_TOO_LARGE");
  });
});
