import { ExternalMediaPlatform, type ExternalMediaEntityType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  externalMediaLinkCreateSchema,
  externalMediaLinkUpdateSchema,
  type ExternalMediaLinkCreateInput,
  type ExternalMediaLinkUpdateInput,
} from "@/lib/validation";
import { AppError } from "@/lib/utils/app-error";
import { detectExternalMediaLink } from "@/features/external-media/detection";

export type ExternalMediaServiceContext = {
  workspaceId: string;
  userId: string;
};

export type ExternalMediaLinkRecord = Awaited<ReturnType<typeof listExternalMediaLinksForEntity>>[number];

type FlickrOembedResponse = {
  type?: unknown;
  title?: unknown;
  url?: unknown;
  thumbnail_url?: unknown;
};

type ExternalMediaPreviewMetadata = {
  title?: string;
  thumbnailUrl?: string;
};

async function assertExternalMediaEntityAccess(
  workspaceId: string,
  entityType: ExternalMediaEntityType,
  entityId: string,
) {
  switch (entityType) {
    case "Tour": {
      const Tour = await prisma.tour.findFirst({
        where: { id: entityId, workspaceId },
        select: { id: true },
      });

      if (!Tour) {
        throw new AppError("external-media-invalid-Tour-reference", "EXTERNAL_MEDIA_INVALID_JOURNEY_REFERENCE");
      }
      return;
    }

    case "TRIP": {
      const trip = await prisma.drivingLog.findFirst({
        where: { id: entityId, workspaceId, deletedAt: null },
        select: { id: true },
      });

      if (!trip) {
        throw new AppError("external-media-invalid-trip-reference", "EXTERNAL_MEDIA_INVALID_TRIP_REFERENCE");
      }
      return;
    }

    case "MOMENT": {
      const moment = await prisma.gig.findFirst({
        where: { id: entityId, workspaceId },
        select: { id: true },
      });

      if (!moment) {
        throw new AppError("external-media-invalid-moment-reference", "EXTERNAL_MEDIA_INVALID_MOMENT_REFERENCE");
      }
      return;
    }

    case "STORY": {
      const story = await prisma.publicPost.findFirst({
        where: { id: entityId, workspaceId },
        select: { id: true },
      });

      if (!story) {
        throw new AppError("external-media-invalid-story-reference", "EXTERNAL_MEDIA_INVALID_STORY_REFERENCE");
      }
      return;
    }
  }
}

function getExternalMediaSelect() {
  return {
    id: true,
    entityType: true,
    entityId: true,
    url: true,
    platform: true,
    title: true,
    caption: true,
    thumbnailUrl: true,
    embedUrl: true,
    externalId: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.ExternalMediaLinkSelect;
}

function getStringMetadataValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function fetchFlickrPreviewMetadata(url: string): Promise<ExternalMediaPreviewMetadata | null> {
  const oembedUrl = new URL("https://www.flickr.com/services/oembed/");
  oembedUrl.searchParams.set("format", "json");
  oembedUrl.searchParams.set("maxwidth", "1024");
  oembedUrl.searchParams.set("url", url);

  try {
    const response = await fetch(oembedUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json().catch(() => null) as FlickrOembedResponse | null;
    if (!body) {
      return null;
    }

    return {
      title: getStringMetadataValue(body.title),
      thumbnailUrl: getStringMetadataValue(body.url) ?? getStringMetadataValue(body.thumbnail_url),
    };
  } catch {
    return null;
  }
}

async function fetchExternalMediaPreviewMetadata(detected: ReturnType<typeof detectExternalMediaLink>) {
  if (detected.platform === ExternalMediaPlatform.FLICKR) {
    return fetchFlickrPreviewMetadata(detected.normalizedUrl);
  }

  return null;
}

async function backfillMissingExternalMediaPreviews<T extends Prisma.ExternalMediaLinkGetPayload<{
  select: ReturnType<typeof getExternalMediaSelect>;
}>>(links: T[]) {
  return Promise.all(links.map(async (link) => {
    if (link.platform === ExternalMediaPlatform.YOUTUBE && (!link.thumbnailUrl || !link.embedUrl || !link.externalId)) {
      const detected = detectExternalMediaLink(link.url);
      if (detected.platform !== ExternalMediaPlatform.YOUTUBE) {
        return link;
      }

      const updatedLink = {
        ...link,
        thumbnailUrl: link.thumbnailUrl ?? detected.thumbnailUrl ?? null,
        embedUrl: link.embedUrl ?? detected.embedUrl ?? null,
        externalId: link.externalId ?? detected.externalId ?? null,
      };

      await prisma.externalMediaLink.update({
        where: { id: link.id },
        data: {
          thumbnailUrl: updatedLink.thumbnailUrl,
          embedUrl: updatedLink.embedUrl,
          externalId: updatedLink.externalId,
        },
        select: getExternalMediaSelect(),
      });

      return updatedLink;
    }

    if (link.platform !== ExternalMediaPlatform.FLICKR || link.thumbnailUrl) {
      return link;
    }

    const previewMetadata = await fetchFlickrPreviewMetadata(link.url);
    if (!previewMetadata?.thumbnailUrl && !previewMetadata?.title) {
      return link;
    }

    const updatedLink = {
      ...link,
      title: link.title ?? previewMetadata.title ?? null,
      thumbnailUrl: previewMetadata.thumbnailUrl ?? link.thumbnailUrl,
    };

    await prisma.externalMediaLink.update({
      where: { id: link.id },
      data: {
        title: updatedLink.title,
        thumbnailUrl: updatedLink.thumbnailUrl,
      },
      select: getExternalMediaSelect(),
    });

    return updatedLink;
  }));
}

export async function listExternalMediaLinksForEntity(
  workspaceId: string,
  entityType: ExternalMediaEntityType,
  entityId: string,
) {
  await assertExternalMediaEntityAccess(workspaceId, entityType, entityId);

  const links = await prisma.externalMediaLink.findMany({
    where: {
      workspaceId,
      entityType,
      entityId,
      deletedAt: null,
    },
    select: getExternalMediaSelect(),
    orderBy: { createdAt: "desc" },
  });

  return backfillMissingExternalMediaPreviews(links);
}

export async function listExternalMediaLinksForJourneyMoments(
  workspaceId: string,
  journeyId: string,
  stopIds: string[],
) {
  await assertExternalMediaEntityAccess(workspaceId, "Tour" as ExternalMediaEntityType, journeyId);

  const entityFilters: Prisma.ExternalMediaLinkWhereInput[] = [
    {
      entityType: "Tour",
      entityId: journeyId,
    },
  ];

  if (stopIds.length) {
    entityFilters.push({
      entityType: "MOMENT",
      entityId: { in: stopIds },
    });
  }

  const links = await prisma.externalMediaLink.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: entityFilters,
    },
    select: getExternalMediaSelect(),
    orderBy: { createdAt: "desc" },
  });

  return backfillMissingExternalMediaPreviews(links);
}

export async function listPublicExternalMediaLinksForJourney(workspaceId: string, journeyId: string, stopIds: string[]) {
  const entityFilters: Prisma.ExternalMediaLinkWhereInput[] = [
    {
      entityType: "Tour",
      entityId: journeyId,
    },
  ];

  if (stopIds.length) {
    entityFilters.push({
      entityType: "MOMENT",
      entityId: { in: stopIds },
    });
  }

  const links = await prisma.externalMediaLink.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: entityFilters,
    },
    select: getExternalMediaSelect(),
    orderBy: { createdAt: "desc" },
  });

  return backfillMissingExternalMediaPreviews(links);
}

export async function createExternalMediaLink(input: ExternalMediaLinkCreateInput, context: ExternalMediaServiceContext) {
  const parsed = externalMediaLinkCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("external-media-invalid-input", "EXTERNAL_MEDIA_INVALID_INPUT");
  }

  await assertExternalMediaEntityAccess(context.workspaceId, parsed.data.entityType, parsed.data.entityId);

  const detected = detectExternalMediaLink(parsed.data.url);
  const previewMetadata = await fetchExternalMediaPreviewMetadata(detected);

  return prisma.externalMediaLink.create({
    data: {
      workspaceId: context.workspaceId,
      createdByUserId: context.userId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      url: detected.normalizedUrl,
      platform: detected.platform,
      title: parsed.data.title || previewMetadata?.title || undefined,
      caption: parsed.data.caption || undefined,
      thumbnailUrl: previewMetadata?.thumbnailUrl ?? detected.thumbnailUrl,
      embedUrl: detected.embedUrl,
      externalId: detected.externalId,
    },
    select: getExternalMediaSelect(),
  });
}

export async function updateExternalMediaLink(
  linkId: string,
  input: ExternalMediaLinkUpdateInput,
  workspaceId: string,
) {
  const parsed = externalMediaLinkUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("external-media-invalid-input", "EXTERNAL_MEDIA_INVALID_INPUT");
  }

  const existingLink = await prisma.externalMediaLink.findFirst({
    where: {
      id: linkId,
      workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!existingLink) {
    throw new AppError("external-media-not-found", "EXTERNAL_MEDIA_NOT_FOUND");
  }

  return prisma.externalMediaLink.update({
    where: { id: linkId },
    data: {
      title: parsed.data.title || null,
      caption: parsed.data.caption || null,
    },
    select: getExternalMediaSelect(),
  });
}

export async function deleteExternalMediaLink(linkId: string, workspaceId: string) {
  const existingLink = await prisma.externalMediaLink.findFirst({
    where: {
      id: linkId,
      workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!existingLink) {
    throw new AppError("external-media-not-found", "EXTERNAL_MEDIA_NOT_FOUND");
  }

  return prisma.externalMediaLink.update({
    where: { id: linkId },
    data: {
      deletedAt: new Date(),
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });
}

export async function softDeleteExternalMediaLinksForEntity(
  workspaceId: string,
  entityType: ExternalMediaEntityType,
  entityId: string,
) {
  return prisma.externalMediaLink.updateMany({
    where: {
      workspaceId,
      entityType,
      entityId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
