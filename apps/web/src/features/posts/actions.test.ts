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
  mockCreatePost,
  mockUpdatePost,
  mockDeletePost,
  mockPublishPost,
  mockUnpublishPost,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockCreatePost: vi.fn(),
  mockUpdatePost: vi.fn(),
  mockDeletePost: vi.fn(),
  mockPublishPost: vi.fn(),
  mockUnpublishPost: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/posts/service", () => ({
  createPost: mockCreatePost,
  updatePost: mockUpdatePost,
  deletePost: mockDeletePost,
  publishPost: mockPublishPost,
  unpublishPost: mockUnpublishPost,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  createPostAction,
  publishPostAction,
  unpublishPostAction,
  updatePostAction,
} from "@/features/posts/actions";

function buildPostFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("post actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1", defaultPostVisibility: "PRIVATE" });
  });

  it("redirects to edit after a successful create and revalidates public surfaces", async () => {
    mockCreatePost.mockResolvedValue({ id: "post-1" });

    const formData = buildPostFormData({
      title: "Launch Post",
      slug: "launch-post",
      excerpt: "Short excerpt",
      content: "This is enough content for a valid post body.",
      status: "DRAFT",
      coverImageUrl: "https://example.com/cover.jpg",
    });

    await expect(createPostAction(formData)).rejects.toMatchObject({
      url: "/dashboard/posts/post-1/edit?success=post-created",
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/posts");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/posts");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("redirects with validation feedback when update input is invalid", async () => {
    const formData = buildPostFormData({
      postId: "post-1",
      title: "x",
      slug: "bad",
      content: "short",
      status: "DRAFT",
    });

    await expect(updatePostAction(formData)).rejects.toMatchObject({
      url: "/dashboard/posts/post-1/edit?error=post-invalid-input",
    });

    expect(mockUpdatePost).not.toHaveBeenCalled();
  });

  it("revalidates and redirects after publish", async () => {
    mockPublishPost.mockResolvedValue({ id: "post-1" });

    const formData = buildPostFormData({
      postId: "post-1",
    });

    await expect(publishPostAction(formData)).rejects.toMatchObject({
      url: "/dashboard/posts/post-1/edit?success=post-published",
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/posts");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/posts/post-1/edit");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/posts");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("redirects with encoded error when unpublish fails", async () => {
    mockUnpublishPost.mockRejectedValue(new AppError("post-not-found", "POST_NOT_FOUND"));

    const formData = buildPostFormData({
      postId: "post-1",
    });

    await expect(unpublishPostAction(formData)).rejects.toMatchObject({
      url: "/dashboard/posts/post-1/edit?error=post-not-found",
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});