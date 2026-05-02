"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { journeyCreateSchema, journeyUpdateSchema } from "@/lib/validation";
import {
  createJourney,
  deleteJourney,
  duplicateJourney,
  setJourneyActiveState,
  updateJourney,
} from "@/features/tours/service";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import { parseVisibility } from "@/lib/visibility";

function getSafeJourneyReturnTo(formData: FormData): string | null {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!raw) {
    return null;
  }

  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }

  return raw;
}

export async function createJourneyAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const parsed = journeyCreateSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    status: formData.get("status"),
    visibility: parseVisibility(formData.get("visibility") ?? workspace.defaultJourneyVisibility),
    coverImageUrl: formData.get("coverImageUrl") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard/Tours/new?error=Tour-invalid-input");
  }

  const Tour = await createJourney(parsed.data, {
    workspaceId: workspace.id,
    userId: user.id,
  });

  revalidatePath("/dashboard/Tours");
  revalidatePath("/dashboard");
  redirect(`/dashboard/Tours/${Tour.id}?success=Tour-created`);
}

export async function updateJourneyAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const journeyId = String(formData.get("journeyId") ?? "").trim();
  if (!journeyId) {
    redirect("/dashboard/Tours?error=invalid-Tour-reference");
  }

  const parsed = journeyUpdateSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    status: formData.get("status"),
    visibility: parseVisibility(formData.get("visibility")),
    coverImageUrl: formData.get("coverImageUrl") || undefined,
  });

  if (!parsed.success) {
    redirect(`/dashboard/Tours/${journeyId}/edit?error=Tour-invalid-input`);
  }

  try {
    await updateJourney(journeyId, parsed.data, { workspaceId: workspace.id });
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath(`/dashboard/Tours/${journeyId}/edit`);
  revalidatePath("/dashboard/Tours");
  revalidatePath("/Tours");
  redirect(`/dashboard/Tours/${journeyId}?success=Tour-updated`);
}

export async function deleteJourneyAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const journeyId = String(formData.get("journeyId") ?? "").trim();
  if (!journeyId) {
    redirect("/dashboard/Tours?error=invalid-Tour-reference");
  }

  try {
    await deleteJourney(journeyId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/Tours");
  revalidatePath("/Tours");
  revalidatePath("/dashboard");
  redirect("/dashboard/Tours?success=Tour-deleted");
}

export async function setJourneyActiveStateAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const journeyId = String(formData.get("journeyId") ?? "").trim();
  const makeActive = String(formData.get("makeActive") ?? "true") === "true";
  const returnTo = getSafeJourneyReturnTo(formData);
  const successRedirect = returnTo ?? `/dashboard/Tours/${journeyId}`;
  if (!journeyId) {
    redirect("/dashboard/Tours?error=invalid-Tour-reference");
  }

  try {
    await setJourneyActiveState(journeyId, workspace.id, makeActive);
  } catch (error) {
    redirect(`${successRedirect}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/Tours");
  revalidatePath(`/dashboard/Tours/${journeyId}`);
  redirect(`${successRedirect}?success=Tour-status-updated`);
}

export async function duplicateJourneyAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();
  const user = await requireAuthenticatedUser();

  const journeyId = String(formData.get("journeyId") ?? "").trim();
  const returnTo = getSafeJourneyReturnTo(formData);
  if (!journeyId) {
    redirect("/dashboard/Tours?error=invalid-Tour-reference");
  }

  let duplicatedId = "";
  try {
    const duplicated = await duplicateJourney(journeyId, {
      workspaceId: workspace.id,
      userId: user.id,
    });
    duplicatedId = duplicated.id;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/Tours");
  } catch (error) {
    redirect(`${returnTo ?? `/dashboard/Tours/${journeyId}`}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  redirect(`${returnTo ?? `/dashboard/Tours/${duplicatedId}`}?success=Tour-duplicated`);
}
