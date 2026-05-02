"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ExternalMediaEntityType } from "@prisma/client";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import {
  createExternalMediaLink,
  deleteExternalMediaLink,
  updateExternalMediaLink,
} from "@/features/external-media/service";

function getSafeReturnTo(formData: FormData, fallback: string) {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }

  return raw;
}

function revalidateExternalMediaSurfaces(entityType: ExternalMediaEntityType, entityId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/media");

  if (entityType === ExternalMediaEntityType.Tour) {
    revalidatePath(`/dashboard/Tours/${entityId}`);
    revalidatePath("/dashboard/Tours");
  } else if (entityType === ExternalMediaEntityType.MOMENT) {
    revalidatePath("/dashboard/Tours");
  }
}

function parseEntityType(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return Object.values(ExternalMediaEntityType).includes(normalized as ExternalMediaEntityType)
    ? normalized as ExternalMediaEntityType
    : null;
}

function parseTarget(value: FormDataEntryValue | null) {
  const [entityTypeValue, ...entityIdParts] = String(value ?? "").split(":");
  const entityType = parseEntityType(entityTypeValue);
  const entityId = entityIdParts.join(":").trim();

  return entityType && entityId ? { entityType, entityId } : null;
}

export async function createExternalMediaLinkAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const target = parseTarget(formData.get("target"));
  const entityType = target?.entityType ?? parseEntityType(formData.get("entityType"));
  const entityId = target?.entityId ?? String(formData.get("entityId") ?? "").trim();
  const returnTo = getSafeReturnTo(
    formData,
    entityType === ExternalMediaEntityType.Tour && entityId ? `/dashboard/Tours/${entityId}` : "/dashboard",
  );

  if (!entityType || !entityId) {
    redirect(`${returnTo}?error=external-media-invalid-reference`);
  }

  try {
    await createExternalMediaLink(
      {
        entityType,
        entityId,
        url: String(formData.get("url") ?? "").trim(),
        title: String(formData.get("title") ?? "").trim() || undefined,
        caption: String(formData.get("caption") ?? "").trim() || undefined,
      },
      {
        workspaceId: workspace.id,
        userId: user.id,
      },
    );
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidateExternalMediaSurfaces(entityType, entityId);
  redirect(`${returnTo}?success=external-media-linked`);
}

export async function updateExternalMediaLinkAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();
  const entityType = parseEntityType(formData.get("entityType"));
  const entityId = String(formData.get("entityId") ?? "").trim();
  const linkId = String(formData.get("linkId") ?? "").trim();
  const returnTo = getSafeReturnTo(
    formData,
    entityType === ExternalMediaEntityType.Tour && entityId ? `/dashboard/Tours/${entityId}` : "/dashboard",
  );

  if (!linkId || !entityType || !entityId) {
    redirect(`${returnTo}?error=external-media-invalid-reference`);
  }

  try {
    await updateExternalMediaLink(linkId, {
      title: String(formData.get("title") ?? "").trim() || undefined,
      caption: String(formData.get("caption") ?? "").trim() || undefined,
    }, workspace.id);
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidateExternalMediaSurfaces(entityType, entityId);
  redirect(`${returnTo}?success=external-media-updated`);
}

export async function deleteExternalMediaLinkAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();
  const entityType = parseEntityType(formData.get("entityType"));
  const entityId = String(formData.get("entityId") ?? "").trim();
  const linkId = String(formData.get("linkId") ?? "").trim();
  const returnTo = getSafeReturnTo(
    formData,
    entityType === ExternalMediaEntityType.Tour && entityId ? `/dashboard/Tours/${entityId}` : "/dashboard",
  );

  if (!linkId || !entityType || !entityId) {
    redirect(`${returnTo}?error=external-media-invalid-reference`);
  }

  try {
    await deleteExternalMediaLink(linkId, workspace.id);
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidateExternalMediaSurfaces(entityType, entityId);
  redirect(`${returnTo}?success=external-media-unlinked`);
}
