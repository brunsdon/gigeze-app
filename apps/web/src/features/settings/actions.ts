"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import { profileSettingsSchema, workspaceSettingsSchema } from "@/lib/validation";
import { updateProfileSettings, updateWorkspaceSettings } from "@/features/settings/service";

export async function updateProfileSettingsAction(formData: FormData) {
  const user = await requireAuthenticatedUser();

  const parsed = profileSettingsSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    redirect("/dashboard/settings?error=settings-profile-invalid");
  }

  try {
    await updateProfileSettings(user.id, parsed.data);
  } catch (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/dashboard/settings?success=settings-profile-saved");
}

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const parsed = workspaceSettingsSchema.safeParse({
    workspaceName: formData.get("workspaceName"),
    workspaceDescription: formData.get("workspaceDescription") || undefined,
    defaultJourneyVisibility: formData.get("defaultJourneyVisibility"),
    defaultPostVisibility: formData.get("defaultPostVisibility"),
    defaultMediaVisibility: formData.get("defaultMediaVisibility"),
    gpsSamplingIntervalSeconds: formData.get("gpsSamplingIntervalSeconds"),
  });

  if (!parsed.success) {
    redirect("/dashboard/settings?error=settings-workspace-invalid");
  }

  try {
    await updateWorkspaceSettings(workspace.id, user.id, parsed.data);
  } catch (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/shared/${workspace.slug}`);
  redirect("/dashboard/settings?success=settings-workspace-saved");
}
