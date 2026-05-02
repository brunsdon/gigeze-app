"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { publicPostCreateSchema, publicPostPublishSchema, publicPostUpdateSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils/app-error";
import { parseVisibility } from "@/lib/visibility";
import {
  createPost,
  deletePost,
  publishPost,
  unpublishPost,
  updatePost,
} from "@/features/posts/service";

const POST_REVALIDATE_PATHS = ["/dashboard/posts", "/posts", "/"] as const;

function revalidatePostPaths(postId?: string) {
  POST_REVALIDATE_PATHS.forEach((path) => revalidatePath(path));
  if (postId) {
    revalidatePath(`/dashboard/posts/${postId}/edit`);
  }
}

function parsePostPayload(formData: FormData, defaultVisibility?: "PRIVATE" | "SHARED" | "PUBLIC") {
  return {
    title: formData.get("title"),
    slug: formData.get("slug") || undefined,
    excerpt: formData.get("excerpt") || undefined,
    content: formData.get("content"),
    status: formData.get("status") || "DRAFT",
    visibility: parseVisibility(formData.get("visibility") ?? defaultVisibility ?? "PRIVATE"),
    coverImageUrl: formData.get("coverImageUrl") || undefined,
    journeyId: formData.get("journeyId") || undefined,
    stopId: formData.get("stopId") || undefined,
  };
}

function parsePublishPayload(formData: FormData) {
  return publicPostPublishSchema.safeParse({
    postId: formData.get("postId"),
  });
}

export async function createPostAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const parsed = publicPostCreateSchema.safeParse(parsePostPayload(formData, workspace.defaultPostVisibility));

  if (!parsed.success) {
    redirect("/dashboard/posts/new?error=post-invalid-input");
  }

  let postId: string;

  try {
    const post = await createPost(parsed.data, { workspaceId: workspace.id, userId: user.id });
    postId = post.id;
  } catch (error) {
    redirect(`/dashboard/posts/new?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePostPaths(postId);
  redirect(`/dashboard/posts/${postId}/edit?success=post-created`);
}

export async function updatePostAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) {
    redirect("/dashboard/posts?error=invalid-post-reference");
  }

  const parsed = publicPostUpdateSchema.safeParse(parsePostPayload(formData));

  if (!parsed.success) {
    redirect(`/dashboard/posts/${postId}/edit?error=post-invalid-input`);
  }

  try {
    await updatePost(postId, parsed.data, workspace.id);
  } catch (error) {
    redirect(`/dashboard/posts/${postId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePostPaths(postId);
  redirect(`/dashboard/posts/${postId}/edit?success=post-updated`);
}

export async function deletePostAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) {
    redirect("/dashboard/posts?error=invalid-post-reference");
  }

  try {
    await deletePost(postId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/posts?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePostPaths();
  redirect("/dashboard/posts?success=post-deleted");
}

export async function publishPostAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const parsed = parsePublishPayload(formData);

  if (!parsed.success) {
    redirect("/dashboard/posts?error=invalid-post-reference");
  }

  const { postId } = parsed.data;

  try {
    await publishPost(postId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/posts/${postId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePostPaths(postId);
  redirect(`/dashboard/posts/${postId}/edit?success=post-published`);
}

export async function unpublishPostAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const parsed = parsePublishPayload(formData);

  if (!parsed.success) {
    redirect("/dashboard/posts?error=invalid-post-reference");
  }

  const { postId } = parsed.data;

  try {
    await unpublishPost(postId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/posts/${postId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePostPaths(postId);
  redirect(`/dashboard/posts/${postId}/edit?success=post-unpublished`);
}
