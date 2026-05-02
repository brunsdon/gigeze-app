import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils/app-error";
import type { ProfileSettingsInput, WorkspaceSettingsInput } from "@/lib/validation";

export async function getSettingsSnapshot(userId: string, workspaceId: string) {
  const [user, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        ownerUserId: true,
        defaultJourneyVisibility: true,
        defaultPostVisibility: true,
        defaultMediaVisibility: true,
        gpsSamplingIntervalSeconds: true,
      },
    }),
  ]);

  if (!user || !workspace) {
    throw new AppError("settings-not-found", "SETTINGS_NOT_FOUND");
  }

  return {
    user,
    workspace,
  };
}

export async function updateProfileSettings(userId: string, input: ProfileSettingsInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      fullName: input.displayName,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });
}

export async function updateWorkspaceSettings(workspaceId: string, ownerUserId: string, input: WorkspaceSettingsInput) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerUserId: true },
  });

  if (!workspace || workspace.ownerUserId !== ownerUserId) {
    throw new AppError("workspace-owner-required", "WORKSPACE_OWNER_REQUIRED");
  }

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: input.workspaceName,
      description: input.workspaceDescription || null,
      defaultJourneyVisibility: input.defaultJourneyVisibility,
      defaultPostVisibility: input.defaultPostVisibility,
      defaultMediaVisibility: input.defaultMediaVisibility,
      gpsSamplingIntervalSeconds: input.gpsSamplingIntervalSeconds,
    },
    select: {
      id: true,
      name: true,
      description: true,
      defaultJourneyVisibility: true,
      defaultPostVisibility: true,
      defaultMediaVisibility: true,
      gpsSamplingIntervalSeconds: true,
    },
  });
}
