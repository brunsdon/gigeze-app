import { randomBytes } from "node:crypto";
import { InvitationStatus, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils/app-error";

export async function listWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function listWorkspaceInvitations(workspaceId: string) {
  return prisma.workspaceInvitation.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: "desc" }],
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createInvitationToken() {
  return randomBytes(24).toString("hex");
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  invitedByUserId: string;
  email: string;
  expiresAt?: Date;
}) {
  const email = normalizeEmail(input.email);

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, ownerUserId: true, slug: true },
  });

  if (!workspace || workspace.ownerUserId !== input.invitedByUserId) {
    throw new AppError("workspace-owner-required", "WORKSPACE_OWNER_REQUIRED");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: existingUser.id,
        },
      },
      select: { id: true },
    });

    if (membership) {
      throw new AppError("workspace-member-already-exists", "WORKSPACE_MEMBER_ALREADY_EXISTS");
    }
  }

  const pendingInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      email,
      status: InvitationStatus.PENDING,
    },
    select: { id: true },
  });

  if (pendingInvitation) {
    throw new AppError("workspace-invitation-already-pending", "WORKSPACE_INVITATION_ALREADY_PENDING");
  }

  return prisma.workspaceInvitation.create({
    data: {
      workspaceId: input.workspaceId,
      invitedByUserId: input.invitedByUserId,
      email,
      role: WorkspaceRole.VIEWER,
      token: createInvitationToken(),
      expiresAt: input.expiresAt,
      status: InvitationStatus.PENDING,
    },
  });
}

export async function revokeWorkspaceInvitation(workspaceId: string, invitationId: string, actingUserId: string) {
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id: invitationId, workspaceId },
    include: {
      workspace: {
        select: { ownerUserId: true },
      },
    },
  });

  if (!invitation || invitation.workspace.ownerUserId !== actingUserId) {
    throw new AppError("workspace-owner-required", "WORKSPACE_OWNER_REQUIRED");
  }

  return prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: InvitationStatus.REVOKED },
  });
}

export async function getInvitationByToken(token: string) {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          ownerUserId: true,
          owner: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    return null;
  }

  const isExpired = Boolean(invitation.expiresAt && invitation.expiresAt < new Date());

  if (isExpired && invitation.status === InvitationStatus.PENDING) {
    return prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
      include: {
        workspace: {
          select: {
            id: true,
            slug: true,
            name: true,
            ownerUserId: true,
            owner: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  return invitation;
}

export async function acceptWorkspaceInvitation(token: string, userId: string, email: string) {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    throw new AppError("workspace-invitation-not-found", "WORKSPACE_INVITATION_NOT_FOUND");
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new AppError("workspace-invitation-not-pending", "WORKSPACE_INVITATION_NOT_PENDING");
  }

  if (normalizeEmail(invitation.email) !== normalizeEmail(email)) {
    throw new AppError("workspace-invitation-email-mismatch", "WORKSPACE_INVITATION_EMAIL_MISMATCH");
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
    create: {
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    },
    update: {
      role: invitation.role,
    },
  });

  return prisma.workspaceInvitation.update({
    where: { id: invitation.id },
    data: {
      status: InvitationStatus.ACCEPTED,
      acceptedByUserId: userId,
      acceptedAt: new Date(),
    },
  });
}

export async function removeWorkspaceMember(workspaceId: string, targetUserId: string, actingUserId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerUserId: true },
  });

  if (!workspace || workspace.ownerUserId !== actingUserId) {
    throw new AppError("workspace-owner-required", "WORKSPACE_OWNER_REQUIRED");
  }

  if (targetUserId === actingUserId) {
    throw new AppError("workspace-cannot-remove-owner", "WORKSPACE_CANNOT_REMOVE_OWNER");
  }

  await prisma.workspaceMember.delete({
    where: {
      workspaceId_userId: { workspaceId, userId: targetUserId },
    },
  });
}

export async function getWorkspaceForMemberBySlug(slug: string, userId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: { slug },
    },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          ownerUserId: true,
        },
      },
    },
  });

  return member
    ? {
        workspace: member.workspace,
        role: member.role,
      }
    : null;
}
