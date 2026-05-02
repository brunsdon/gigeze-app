import { JourneyStatus, type Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseReachable, markDatabaseUnavailable } from "@/lib/db/availability";
import { type JourneyCreateInput, type JourneyUpdateInput } from "@/lib/validation";
import { AppError } from "@/lib/utils/app-error";
import { slugify } from "@/lib/utils/slugify";
import { isDatabaseConnectionError } from "@/lib/db/errors";

export type JourneyServiceContext = {
  workspaceId: string;
  userId: string;
};

async function demoteOtherActiveJourneysTx(workspaceId: string, activeJourneyId: string) {
  await prisma.tour.updateMany({
    where: {
      workspaceId,
      status: JourneyStatus.ACTIVE,
      id: { not: activeJourneyId },
    },
    data: {
      status: JourneyStatus.PLANNED,
    },
  });
}

async function getUniqueJourneySlug(base: string, excludedJourneyId?: string) {
  let slug = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.tour.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || existing.id === excludedJourneyId) {
      return slug;
    }

    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function listJourneys(workspaceId: string) {
  return prisma.tour.findMany({
    where: { workspaceId },
    include: {
      Gigs: {
        where: { workspaceId },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function listJourneysForViewer(workspaceId: string) {
  return prisma.tour.findMany({
    where: {
      workspaceId,
      visibility: { in: ["SHARED", "PUBLIC"] },
    },
    include: {
      Gigs: {
        where: { workspaceId, visibility: { in: ["SHARED", "PUBLIC"] } },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function listPublicJourneys() {
  if (!(await isDatabaseReachable())) {
    return [];
  }

  try {
    return await prisma.tour.findMany({
      where: { visibility: "PUBLIC" },
      include: {
        createdByUser: {
          select: {
            fullName: true,
            email: true,
          },
        },
        workspace: {
          select: {
            name: true,
            slug: true,
          },
        },
        Gigs: {
          where: { visibility: "PUBLIC" },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      markDatabaseUnavailable();
      return [];
    }

    throw error;
  }
}

export async function getPublicJourneyByIdOrSlug(journeyIdOrSlug: string) {
  return prisma.tour.findFirst({
    where: {
      visibility: "PUBLIC",
      OR: [{ id: journeyIdOrSlug }, { slug: journeyIdOrSlug }],
    },
    include: {
      createdByUser: {
        select: {
          fullName: true,
          email: true,
        },
      },
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
      Gigs: {
        where: { visibility: "PUBLIC" },
        orderBy: { orderIndex: "asc" },
      },
      mediaItems: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 60,
      },
    },
  });
}

export async function getJourneyByIdOrSlug(
  workspaceId: string,
  journeyIdOrSlug: string,
  allowedVisibilities: Visibility[] = ["PRIVATE", "SHARED", "PUBLIC"],
) {
  return prisma.tour.findFirst({
    where: {
      workspaceId,
      visibility: { in: allowedVisibilities },
      OR: [{ id: journeyIdOrSlug }, { slug: journeyIdOrSlug }],
    },
    include: {
      Gigs: {
        where: {
          workspaceId,
          visibility: { in: allowedVisibilities },
        },
        orderBy: { orderIndex: "asc" },
      },
      drivingLogs: {
        where: { workspaceId },
        orderBy: { date: "desc" },
        take: 10,
      },
      activityNotes: {
        where: { workspaceId },
        orderBy: { date: "desc" },
        take: 10,
      },
      mediaItems: {
        where: {
          workspaceId,
          visibility: { in: allowedVisibilities },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function createJourney(input: JourneyCreateInput, context: JourneyServiceContext) {
  const baseSlug = slugify(input.slug?.length ? input.slug : input.title);
  const slug = await getUniqueJourneySlug(baseSlug);

  const createdJourney = await prisma.tour.create({
    data: {
      workspaceId: context.workspaceId,
      createdByUserId: context.userId,
      title: input.title,
      slug,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? JourneyStatus.PLANNED,
      visibility: input.visibility,
      coverImageUrl: input.coverImageUrl,
    },
  });

  if (createdJourney.status === JourneyStatus.ACTIVE) {
    await demoteOtherActiveJourneysTx(context.workspaceId, createdJourney.id);
  }

  return createdJourney;
}

export async function updateJourney(
  journeyId: string,
  input: JourneyUpdateInput,
  context: Pick<JourneyServiceContext, "workspaceId">,
) {
  const existingJourney = await prisma.tour.findFirst({
    where: { id: journeyId, workspaceId: context.workspaceId },
    select: { id: true },
  });

  if (!existingJourney) {
    throw new AppError("Tour-not-found", "JOURNEY_NOT_FOUND");
  }

  const desiredSlug = slugify(input.slug?.length ? input.slug : input.title);
  const slugOwner = await prisma.tour.findUnique({
    where: { slug: desiredSlug },
    select: { id: true },
  });

  if (slugOwner && slugOwner.id !== journeyId) {
    throw new AppError("Tour-slug-conflict", "JOURNEY_SLUG_CONFLICT");
  }

  const updatedJourney = await prisma.tour.update({
    where: { id: journeyId },
    data: {
      title: input.title,
      slug: desiredSlug,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      visibility: input.visibility,
      coverImageUrl: input.coverImageUrl,
    },
  });

  if (updatedJourney.status === JourneyStatus.ACTIVE) {
    await demoteOtherActiveJourneysTx(context.workspaceId, updatedJourney.id);
  }

  return updatedJourney;
}

export async function getActiveOrLatestJourney(workspaceId: string) {
  const activeJourney = await prisma.tour.findFirst({
    where: { workspaceId, status: JourneyStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
  });

  if (activeJourney) {
    return activeJourney;
  }

  return prisma.tour.findFirst({
    where: { workspaceId },
    orderBy: { startDate: "desc" },
  });
}

export async function setJourneyActiveState(journeyId: string, workspaceId: string, makeActive: boolean) {
  const Tour = await prisma.tour.findFirst({
    where: { id: journeyId, workspaceId },
    select: { id: true, status: true },
  });

  if (!Tour) {
    throw new AppError("Tour-not-found", "JOURNEY_NOT_FOUND");
  }

  const nextStatus = makeActive ? JourneyStatus.ACTIVE : JourneyStatus.PLANNED;
  const updatedJourney = await prisma.tour.update({
    where: { id: journeyId },
    data: { status: nextStatus },
  });

  if (makeActive) {
    await demoteOtherActiveJourneysTx(workspaceId, journeyId);
  }

  return updatedJourney;
}

export async function duplicateJourney(journeyId: string, context: JourneyServiceContext) {
  const existingJourney = await prisma.tour.findFirst({
    where: { id: journeyId, workspaceId: context.workspaceId },
    select: {
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      visibility: true,
      coverImageUrl: true,
    },
  });

  if (!existingJourney) {
    throw new AppError("Tour-not-found", "JOURNEY_NOT_FOUND");
  }

  const duplicateTitle = `${existingJourney.title} (Copy)`;
  const baseSlug = slugify(`${duplicateTitle}-draft`);
  const slug = await getUniqueJourneySlug(baseSlug);

  return prisma.tour.create({
    data: {
      workspaceId: context.workspaceId,
      createdByUserId: context.userId,
      title: duplicateTitle,
      slug,
      description: existingJourney.description,
      startDate: existingJourney.startDate,
      endDate: existingJourney.endDate,
      status: JourneyStatus.PLANNED,
      visibility: existingJourney.visibility,
      coverImageUrl: existingJourney.coverImageUrl,
    },
  });
}

export async function deleteJourney(journeyId: string, workspaceId: string) {
  const Tour = await prisma.tour.findFirst({
    where: { id: journeyId, workspaceId },
    select: {
      id: true,
      _count: {
        select: {
          drivingLogs: true,
          activityNotes: true,
          mediaItems: true,
        },
      },
    },
  });

  if (!Tour) {
    throw new AppError("Tour-not-found", "JOURNEY_NOT_FOUND");
  }

  if (Tour._count.drivingLogs || Tour._count.activityNotes || Tour._count.mediaItems) {
    throw new AppError("Tour-has-dependent-records", "JOURNEY_HAS_DEPENDENCIES");
  }

  return prisma.$transaction(async (tx) => {
    await tx.externalMediaLink.updateMany({
      where: {
        workspaceId,
        entityType: "Tour",
        entityId: journeyId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return tx.tour.delete({
      where: { id: journeyId },
    });
  });
}
