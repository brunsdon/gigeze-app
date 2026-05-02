"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { stopCreateSchema, stopUpdateSchema } from "@/lib/validation";
import {
  createStop,
  deleteStop,
  duplicateStop,
  moveStopDown,
  moveStopUp,
  updateStop,
} from "@/features/gigs/service";
import { getErrorMessage } from "@/lib/utils/app-error";
import { parseVisibility } from "@/lib/visibility";

export async function createStopAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const journeyId = String(formData.get("journeyId") ?? "");

  const parsed = stopCreateSchema.safeParse({
    journeyId,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    locationName: formData.get("locationName") || undefined,
    arrivalDate: formData.get("arrivalDate") || undefined,
    departureDate: formData.get("departureDate") || undefined,
    visibility: parseVisibility(formData.get("visibility")),
    orderIndex: formData.get("orderIndex") || 0,
  });

  if (!parsed.success) {
    redirect(`/dashboard/Tours/${journeyId}?error=Gig-invalid-input`);
  }

  try {
    await createStop(parsed.data, { workspaceId: workspace.id, userId: user.id });
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath("/dashboard/Tours");
  redirect(`/dashboard/Tours/${journeyId}?success=Gig-created`);
}

export async function updateStopAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const stopId = String(formData.get("stopId") ?? "").trim();
  const journeyId = String(formData.get("journeyId") ?? "").trim();

  if (!stopId || !journeyId) {
    redirect("/dashboard/Tours?error=invalid-Gig-reference");
  }

  const parsed = stopUpdateSchema.safeParse({
    journeyId,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    locationName: formData.get("locationName") || undefined,
    arrivalDate: formData.get("arrivalDate") || undefined,
    departureDate: formData.get("departureDate") || undefined,
    visibility: parseVisibility(formData.get("visibility")),
    orderIndex: formData.get("orderIndex") || 0,
  });

  if (!parsed.success) {
    redirect(`/dashboard/Tours/${journeyId}/Gigs/${stopId}/edit?error=Gig-invalid-input`);
  }

  try {
    await updateStop(stopId, parsed.data, workspace.id);
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}/Gigs/${stopId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath(`/dashboard/Tours/${journeyId}/Gigs/${stopId}/edit`);
  revalidatePath("/dashboard/Tours");
  revalidatePath(`/Tours/${journeyId}`);
  redirect(`/dashboard/Tours/${journeyId}?success=Gig-updated`);
}

export async function deleteStopAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const stopId = String(formData.get("stopId") ?? "").trim();
  const journeyId = String(formData.get("journeyId") ?? "").trim();

  if (!stopId || !journeyId) {
    redirect("/dashboard/Tours?error=invalid-Gig-reference");
  }

  try {
    await deleteStop(stopId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath("/dashboard/Tours");
  revalidatePath(`/Tours/${journeyId}`);
  redirect(`/dashboard/Tours/${journeyId}?success=Gig-deleted`);
}

export async function moveStopUpAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const stopId = String(formData.get("stopId") ?? "").trim();
  const journeyId = String(formData.get("journeyId") ?? "").trim();

  if (!stopId || !journeyId) {
    redirect("/dashboard/Tours?error=invalid-Gig-reference");
  }

  try {
    await moveStopUp(stopId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath(`/Tours/${journeyId}`);
  redirect(`/dashboard/Tours/${journeyId}?success=Gig-order-updated`);
}

export async function moveStopDownAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const stopId = String(formData.get("stopId") ?? "").trim();
  const journeyId = String(formData.get("journeyId") ?? "").trim();

  if (!stopId || !journeyId) {
    redirect("/dashboard/Tours?error=invalid-Gig-reference");
  }

  try {
    await moveStopDown(stopId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath(`/Tours/${journeyId}`);
  redirect(`/dashboard/Tours/${journeyId}?success=Gig-order-updated`);
}

export async function duplicateStopAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();
  const user = await requireAuthenticatedUser();

  const stopId = String(formData.get("stopId") ?? "").trim();
  const journeyId = String(formData.get("journeyId") ?? "").trim();

  if (!stopId || !journeyId) {
    redirect("/dashboard/Tours?error=invalid-Gig-reference");
  }

  try {
    await duplicateStop(stopId, {
      workspaceId: workspace.id,
      userId: user.id,
    });
  } catch (error) {
    redirect(`/dashboard/Tours/${journeyId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/dashboard/Tours/${journeyId}`);
  revalidatePath("/dashboard/Tours");
  revalidatePath(`/Tours/${journeyId}`);
  redirect(`/dashboard/Tours/${journeyId}?success=Gig-duplicated`);
}
