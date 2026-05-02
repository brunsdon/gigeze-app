"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
} from "@/features/workspaces/service";

export async function createWorkspaceInvitationAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const email = String(formData.get("email") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();

  if (!email) {
    redirect("/dashboard/sharing?error=workspace-invitation-invalid-email");
  }

  try {
    await createWorkspaceInvitation({
      workspaceId: workspace.id,
      invitedByUserId: user.id,
      email,
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : undefined,
    });
  } catch (error) {
    redirect(`/dashboard/sharing?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/sharing");
  redirect("/dashboard/sharing?success=workspace-invitation-created");
}

export async function revokeWorkspaceInvitationAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const invitationId = String(formData.get("invitationId") ?? "").trim();

  if (!invitationId) {
    redirect("/dashboard/sharing?error=workspace-invitation-invalid-reference");
  }

  try {
    await revokeWorkspaceInvitation(workspace.id, invitationId, user.id);
  } catch (error) {
    redirect(`/dashboard/sharing?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/sharing");
  redirect("/dashboard/sharing?success=workspace-invitation-revoked");
}

export async function acceptWorkspaceInvitationAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const token = String(formData.get("token") ?? "").trim();

  if (!token) {
    redirect("/dashboard?error=workspace-invitation-invalid-reference");
  }

  try {
    await acceptWorkspaceInvitation(token, user.id, user.email);
  } catch (error) {
    redirect(`/invite/${token}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath(`/invite/${token}`);
  redirect("/dashboard");
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();

  if (!targetUserId) {
    redirect("/dashboard/sharing?error=workspace-member-invalid-reference");
  }

  try {
    await removeWorkspaceMember(workspace.id, targetUserId, user.id);
  } catch (error) {
    redirect(`/dashboard/sharing?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/sharing");
  redirect("/dashboard/sharing?success=workspace-member-removed");
}
