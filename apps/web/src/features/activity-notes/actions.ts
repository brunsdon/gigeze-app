"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { activityNoteCreateSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils/app-error";
import { parseVisibility } from "@/lib/visibility";
import { createActivityNote, deleteActivityNote, updateActivityNote } from "@/features/activity-notes/service";

function getSafeReturnTo(formData: FormData, fallback = "/dashboard/activity") {
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return fallback;
  }

  return returnTo;
}

function withFeedback(url: string, key: "error" | "success", value: string) {
  const [pathAndQuery, hash] = url.split("#", 2);
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  return `${pathAndQuery}${separator}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

function parseActivityForm(formData: FormData) {
  return activityNoteCreateSchema.safeParse({
    journeyId: formData.get("journeyId") || undefined,
    stopId: formData.get("stopId") || undefined,
    type: formData.get("type"),
    date: formData.get("date"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    visibility: parseVisibility(formData.get("visibility")),
  });
}

export async function createActivityNoteAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const returnTo = getSafeReturnTo(formData);

  const parsed = parseActivityForm(formData);
  if (!parsed.success) {
    redirect(withFeedback(returnTo, "error", "activity-note-invalid-input"));
  }

  try {
    await createActivityNote(parsed.data, { workspaceId: workspace.id, userId: user.id });
  } catch (error) {
    redirect(withFeedback(returnTo, "error", getErrorMessage(error)));
  }

  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/Tours/${parsed.data.journeyId}`);
  redirect(withFeedback(returnTo, "success", "activity-note-created"));
}

export async function updateActivityNoteAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();
  const returnTo = getSafeReturnTo(formData);

  const noteId = String(formData.get("noteId") ?? "").trim();
  if (!noteId) {
    redirect(withFeedback(returnTo, "error", "invalid-activity-note-reference"));
  }

  const parsed = parseActivityForm(formData);
  if (!parsed.success) {
    redirect(withFeedback(returnTo, "error", "activity-note-invalid-input"));
  }

  try {
    await updateActivityNote(noteId, parsed.data, workspace.id);
  } catch (error) {
    redirect(withFeedback(returnTo, "error", getErrorMessage(error)));
  }

  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/Tours/${parsed.data.journeyId}`);
  redirect(withFeedback(returnTo, "success", "activity-note-updated"));
}

export async function deleteActivityNoteAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const noteId = String(formData.get("noteId") ?? "").trim();
  if (!noteId) {
    redirect("/dashboard/activity?error=invalid-activity-note-reference");
  }

  try {
    await deleteActivityNote(noteId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/activity?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirect("/dashboard/activity?success=activity-note-deleted");
}
