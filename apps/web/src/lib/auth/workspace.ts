import { redirect } from "next/navigation";
import { cache } from "react";
import { type Visibility, WorkspaceRole } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { isEnvConfigError } from "@/lib/env";
import { isDatabaseConnectionError, isPrismaUniqueConstraintError } from "@/lib/db/errors";
import { markDatabaseUnavailable } from "@/lib/db/availability";
import { slugify } from "@/lib/utils/slugify";

export type SessionUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  supabaseAuthUserId: string | null;
};

export type CurrentWorkspace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerUserId: string;
  defaultJourneyVisibility: Visibility;
  defaultPostVisibility: Visibility;
  defaultMediaVisibility: Visibility;
  gpsSamplingIntervalSeconds: number;
  role: WorkspaceRole;
};

type WorkspaceLike = {
  ownerUserId: string;
};

type ViewerLike = {
  id: string;
  role: WorkspaceRole | null;
} | null;

const WORKSPACE_CREATE_MAX_RETRIES = 5;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  };
}

async function ensureUniqueWorkspaceSlug(baseInput: string) {
  const fallback = `workspace-${Date.now().toString(36)}`;
  const baseSlug = slugify(baseInput) || fallback;

  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function ensureOwnedWorkspace(user: CurrentUser) {
  const existing = await prisma.workspace.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      ownerUserId: true,
      defaultJourneyVisibility: true,
      defaultPostVisibility: true,
      defaultMediaVisibility: true,
      gpsSamplingIntervalSeconds: true,
    },
  });

  if (existing) {
    return {
      ...existing,
      role: WorkspaceRole.OWNER,
    } satisfies CurrentWorkspace;
  }

  const workspaceName = user.fullName?.trim().length
    ? `${user.fullName.trim()}'s Workspace`
    : `${user.email.split("@")[0] || "Personal"}'s Workspace`;

  const slugBase = `${user.email.split("@")[0] || "workspace"}-workspace`;

  let lastError: unknown;

  for (let attempt = 0; attempt < WORKSPACE_CREATE_MAX_RETRIES; attempt += 1) {
    const slug = await ensureUniqueWorkspaceSlug(slugBase);

    try {
      const created = await prisma.workspace.create({
        data: {
          slug,
          name: workspaceName,
          ownerUserId: user.id,
          members: {
            create: {
              userId: user.id,
              role: WorkspaceRole.OWNER,
            },
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          ownerUserId: true,
          defaultJourneyVisibility: true,
          defaultPostVisibility: true,
          defaultMediaVisibility: true,
          gpsSamplingIntervalSeconds: true,
        },
      });

      return {
        ...created,
        role: WorkspaceRole.OWNER,
      } satisfies CurrentWorkspace;
    } catch (error) {
      lastError = error;

      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const ownedWorkspace = await prisma.workspace.findUnique({
        where: { ownerUserId: user.id },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          ownerUserId: true,
          defaultJourneyVisibility: true,
          defaultPostVisibility: true,
          defaultMediaVisibility: true,
          gpsSamplingIntervalSeconds: true,
        },
      });

      if (ownedWorkspace) {
        return {
          ...ownedWorkspace,
          role: WorkspaceRole.OWNER,
        } satisfies CurrentWorkspace;
      }
    }
  }

  throw lastError;
}

const getCurrentUserUncached = async (): Promise<CurrentUser | null> => {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !sessionUser.email) {
      return null;
    }

    return getOrCreateCurrentUserFromSessionUser(sessionUser);
  } catch (error) {
    if (isEnvConfigError(error)) {
      return null;
    }

    if (isDatabaseConnectionError(error)) {
      markDatabaseUnavailable();
      redirect("/login?error=db-unavailable");
    }

    throw error;
  }
};

export const getCurrentUser = cache(getCurrentUserUncached);

export async function getOrCreateCurrentUserFromSessionUser(sessionUser: SessionUser): Promise<CurrentUser | null> {
  if (!sessionUser.email) {
    return null;
  }

  const email = normalizeEmail(sessionUser.email);

  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: sessionUser.user_metadata?.full_name?.trim() || null,
      supabaseAuthUserId: sessionUser.id,
    },
    update: {
      supabaseAuthUserId: sessionUser.id,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      supabaseAuthUserId: true,
    },
  });
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

const getCurrentWorkspaceForUserUncached = async (userId?: string): Promise<CurrentWorkspace | null> => {
  const user = userId
    ? await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        supabaseAuthUserId: true,
      },
    })
    : await getCurrentUser();

  if (!user) {
    return null;
  }

  return ensureOwnedWorkspace(user);
};

export const getCurrentWorkspaceForUser = cache(getCurrentWorkspaceForUserUncached);

export async function requireWorkspaceOwner(workspaceId?: string) {
  const user = await requireAuthenticatedUser();
  return requireWorkspaceOwnerForUser(user.id, workspaceId);
}

export async function getWorkspaceOwnerForUser(userId: string, workspaceId?: string) {
  const workspace = workspaceId
    ? await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerUserId: userId },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        ownerUserId: true,
        defaultJourneyVisibility: true,
        defaultPostVisibility: true,
        defaultMediaVisibility: true,
        gpsSamplingIntervalSeconds: true,
      },
      })
    : await getCurrentWorkspaceForUser(userId);

  if (!workspace || workspace.ownerUserId !== userId) {
    return null;
  }

  return workspace;
}

export async function requireWorkspaceOwnerForUser(userId: string, workspaceId?: string) {
  const workspace = await getWorkspaceOwnerForUser(userId, workspaceId);

  if (!workspace) {
    redirect("/");
  }

  return {
    ...workspace,
    role: WorkspaceRole.OWNER,
  };
}

export async function requireCurrentWorkspace() {
  const user = await requireAuthenticatedUser();
  const workspace = await getCurrentWorkspaceForUser(user.id);

  if (!workspace) {
    redirect("/");
  }

  return workspace;
}

export async function getUserWorkspaceRole(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: { role: true },
  });

  return member?.role ?? null;
}

export function canViewWorkspaceContent(user: ViewerLike, workspace: WorkspaceLike, visibility: Visibility) {
  if (visibility === "PUBLIC") {
    return true;
  }

  if (!user) {
    return false;
  }

  if (workspace.ownerUserId === user.id || user.role === WorkspaceRole.OWNER) {
    return true;
  }

  if (visibility === "SHARED") {
    return user.role === WorkspaceRole.VIEWER;
  }

  return false;
}

export function canManageWorkspaceContent(user: ViewerLike, workspace: WorkspaceLike) {
  if (!user) {
    return false;
  }

  return workspace.ownerUserId === user.id || user.role === WorkspaceRole.OWNER;
}
