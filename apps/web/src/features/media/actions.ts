"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import { parseVisibility } from "@/lib/visibility";
import { createMediaMetadata, deleteMediaWithStorage, updateMediaMetadata } from "@/features/media/service";

export async function createMediaMetadataAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const filePath = String(formData.get("filePath") ?? "").trim();
  const fileName = String(formData.get("fileName") ?? "").trim();

  if (!filePath || !fileName) {
    redirect("/dashboard/media?error=missing-file-path-name");
  }

  try {
    await createMediaMetadata({
      journeyId: String(formData.get("journeyId") ?? "").trim() || undefined,
      stopId: String(formData.get("stopId") ?? "").trim() || undefined,
      filePath,
      fileName,
      mimeType: String(formData.get("mimeType") ?? "").trim() || undefined,
      sizeBytes: Number(formData.get("sizeBytes") ?? 0) || undefined,
      caption: String(formData.get("caption") ?? "").trim() || undefined,
      visibility: parseVisibility(formData.get("visibility") ?? workspace.defaultMediaVisibility),
      publicUrl: String(formData.get("publicUrl") ?? "").trim() || undefined,
    }, {
      workspaceId: workspace.id,
      userId: user.id,
    });
  } catch (error) {
    redirect(`/dashboard/media?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard");
  redirect("/dashboard/media?success=metadata-created");
}

export async function updateMediaMetadataAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!mediaId) {
    redirect("/dashboard/media?error=invalid-media-reference");
  }

  const filePath = String(formData.get("filePath") ?? "").trim();
  const fileName = String(formData.get("fileName") ?? "").trim();

  if (!filePath || !fileName) {
    redirect("/dashboard/media?error=missing-file-path-name");
  }

  try {
    await updateMediaMetadata(mediaId, {
      journeyId: String(formData.get("journeyId") ?? "").trim() || undefined,
      stopId: String(formData.get("stopId") ?? "").trim() || undefined,
      filePath,
      fileName,
      mimeType: String(formData.get("mimeType") ?? "").trim() || undefined,
      sizeBytes: Number(formData.get("sizeBytes") ?? 0) || undefined,
      caption: String(formData.get("caption") ?? "").trim() || undefined,
      visibility: parseVisibility(formData.get("visibility") ?? workspace.defaultMediaVisibility),
      publicUrl: String(formData.get("publicUrl") ?? "").trim() || undefined,
    }, workspace.id);
  } catch (error) {
    redirect(`/dashboard/media?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard");
  redirect("/dashboard/media?success=media-updated");
}

export async function deleteMediaAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!mediaId) {
    redirect("/dashboard/media?error=invalid-media-reference");
  }

  try {
    await deleteMediaWithStorage(mediaId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/media?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard");
  redirect("/dashboard/media?success=media-deleted");
}
