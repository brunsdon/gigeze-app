import { type Prisma, type Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseReachable, markDatabaseUnavailable } from "@/lib/db/availability";
import { isDatabaseConnectionError } from "@/lib/db/errors";
import { getServerEnv } from "@/lib/env/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { mediaMetadataSchema, type MediaMetadataInput } from "@/lib/validation";
import { AppError } from "@/lib/utils/app-error";
import { resolvePublicMediaRawUrl } from "@/features/media/public-url";
import { SupabaseStorageService } from "@/features/media/supabase-storage-service";

export type MediaServiceContext = {
  workspaceId: string;
  userId: string;
};

export type PublicMediaFilters = {
  journeyId?: string;
  stopId?: string;
};

export type PublicGalleryMediaItem = {
  id: string;
  filePath: string;
  fileName: string;
  publicUrl: string | null;
  mimeType: string | null;
  caption: string | null;
  createdAt: Date;
  createdByUser: {
    fullName: string | null;
    email: string;
  } | null;
  workspace: {
    name: string;
    slug: string;
  } | null;
  Tour: {
    id: string;
    title: string;
    slug: string;
  } | null;
  Gig: {
    id: string;
    title: string;
    journeyId: string;
  } | null;
};

export type PublicMediaFilterOptions = {
  Tours: Array<{
    id: string;
    title: string;
    slug: string;
  }>;
  Gigs: Array<{
    id: string;
    title: string;
    journeyId: string;
    journeyTitle: string;
  }>;
};

type PublicMediaQueryResult = {
  id: string;
  filePath: string;
  fileName: string;
  publicUrl: string | null;
  mimeType: string | null;
  caption: string | null;
  createdAt: Date;
  createdByUser: {
    fullName: string | null;
    email: string;
  } | null;
  workspace: {
    name: string;
    slug: string;
  } | null;
  Tour: {
    id: string;
    title: string;
    slug: string;
    visibility: Visibility;
  } | null;
  Gig: {
    id: string;
    title: string;
    journeyId: string;
    visibility: Visibility;
    Tour: {
      id: string;
      title: string;
      slug: string;
      visibility: Visibility;
    } | null;
  } | null;
};

function sanitizePublicMediaItem(item: PublicMediaQueryResult): PublicGalleryMediaItem {
  const Tour = item.Tour?.visibility === "PUBLIC"
    ? {
      id: item.Tour.id,
      title: item.Tour.title,
      slug: item.Tour.slug,
    }
    : null;

  const Gig = item.Gig?.visibility === "PUBLIC" && item.Gig.Tour?.visibility === "PUBLIC"
    ? {
      id: item.Gig.id,
      title: item.Gig.title,
      journeyId: item.Gig.journeyId,
    }
    : null;

  return {
    id: item.id,
    filePath: item.filePath,
    fileName: item.fileName,
    publicUrl: item.publicUrl,
    mimeType: item.mimeType,
    caption: item.caption,
    createdAt: item.createdAt,
    createdByUser: item.createdByUser,
    workspace: item.workspace,
    Tour,
    Gig,
  };
}

function buildPublicMediaWhere(filters?: PublicMediaFilters): Prisma.MediaWhereInput {
  const where: Prisma.MediaWhereInput = {
    visibility: "PUBLIC",
  };

  if (filters?.journeyId) {
    where.journeyId = filters.journeyId;
    where.Tour = { visibility: "PUBLIC" };
  }

  if (filters?.stopId) {
    where.stopId = filters.stopId;
    where.Gig = {
      visibility: "PUBLIC",
      Tour: { visibility: "PUBLIC" },
    };
  }

  return where;
}

function getPublicMediaInclude() {
  return {
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
    Tour: {
      select: {
        id: true,
        title: true,
        slug: true,
        visibility: true,
      },
    },
    Gig: {
      select: {
        id: true,
        title: true,
        journeyId: true,
        visibility: true,
        Tour: {
          select: {
            id: true,
            title: true,
            slug: true,
            visibility: true,
          },
        },
      },
    },
  } satisfies Prisma.MediaInclude;
}

async function assertMediaReferences(workspaceId: string, journeyId?: string, stopId?: string) {
  let stopJourneyId: string | undefined;

  if (journeyId) {
    const Tour = await prisma.tour.findFirst({
      where: { id: journeyId, workspaceId },
      select: { id: true },
    });

    if (!Tour) {
      throw new AppError("invalid-Tour-reference", "INVALID_JOURNEY_REFERENCE");
    }
  }

  if (stopId) {
    const Gig = await prisma.gig.findFirst({
      where: { id: stopId, workspaceId },
      select: { id: true, journeyId: true },
    });

    if (!Gig) {
      throw new AppError("invalid-Gig-reference", "INVALID_STOP_REFERENCE");
    }

    stopJourneyId = Gig.journeyId;
  }

  if (journeyId && stopJourneyId && journeyId !== stopJourneyId) {
    throw new AppError("Gig-Tour-mismatch", "STOP_JOURNEY_MISMATCH");
  }
}

function normalizeStoredPublicUrl(input: Pick<MediaMetadataInput, "filePath" | "fileName" | "mimeType" | "publicUrl">) {
  return resolvePublicMediaRawUrl(input, {
    bucket: getServerEnv().SUPABASE_STORAGE_BUCKET,
    supabaseUrl: getSupabasePublicEnv().url,
  }) ?? undefined;
}

export async function listMediaItems(workspaceId: string) {
  return prisma.media.findMany({
    where: { workspaceId },
    include: {
      Tour: { select: { id: true, title: true, slug: true } },
      Gig: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMediaItemsForViewer(workspaceId: string) {
  return prisma.media.findMany({
    where: {
      workspaceId,
      visibility: { in: ["SHARED", "PUBLIC"] },
    },
    include: {
      Tour: { select: { id: true, title: true, slug: true } },
      Gig: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPublicMediaItems(
  filters?: PublicMediaFilters,
  options?: { limit?: number },
): Promise<PublicGalleryMediaItem[]> {
  if (!(await isDatabaseReachable())) {
    return [];
  }

  try {
    const items = await prisma.media.findMany({
      where: buildPublicMediaWhere(filters),
      include: getPublicMediaInclude(),
      orderBy: { createdAt: "desc" },
      take: options?.limit,
    });

    return items.map((item) => sanitizePublicMediaItem(item));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      markDatabaseUnavailable();
      return [];
    }

    throw error;
  }
}

export async function listPublicMediaFilterOptions(filters?: Pick<PublicMediaFilters, "journeyId">): Promise<PublicMediaFilterOptions> {
  if (!(await isDatabaseReachable())) {
    return { Tours: [], Gigs: [] };
  }

  try {
    const [journeyLinkedItems, stopLinkedItems] = await Promise.all([
      prisma.media.findMany({
        where: {
          visibility: "PUBLIC",
          Tour: { visibility: "PUBLIC" },
        },
        include: {
          Tour: {
            select: {
              id: true,
              title: true,
              slug: true,
              visibility: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.media.findMany({
        where: {
          visibility: "PUBLIC",
          ...(filters?.journeyId ? { journeyId: filters.journeyId } : {}),
          Gig: {
            visibility: "PUBLIC",
            Tour: { visibility: "PUBLIC" },
          },
        },
        include: {
          Gig: {
            select: {
              id: true,
              title: true,
              journeyId: true,
              visibility: true,
              Tour: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  visibility: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const Tours = Array.from(
      new Map(
        journeyLinkedItems
          .filter((item) => item.Tour?.visibility === "PUBLIC")
          .map((item) => [item.Tour!.id, {
            id: item.Tour!.id,
            title: item.Tour!.title,
            slug: item.Tour!.slug,
          }]),
      ).values(),
    );

    const Gigs = Array.from(
      new Map(
        stopLinkedItems
          .filter((item) => item.Gig?.visibility === "PUBLIC" && item.Gig.Tour?.visibility === "PUBLIC")
          .map((item) => [item.Gig!.id, {
            id: item.Gig!.id,
            title: item.Gig!.title,
            journeyId: item.Gig!.journeyId,
            journeyTitle: item.Gig!.Tour?.title ?? "Linked Tour",
          }]),
      ).values(),
    );

    return { Tours, Gigs };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      markDatabaseUnavailable();
      return { Tours: [], Gigs: [] };
    }

    throw error;
  }
}

export async function getMediaItemById(workspaceId: string, mediaId: string) {
  return prisma.media.findFirst({
    where: { id: mediaId, workspaceId },
    include: {
      Tour: { select: { id: true, title: true, slug: true } },
      Gig: { select: { id: true, title: true, journeyId: true } },
    },
  });
}

export async function createMediaMetadata(input: MediaMetadataInput, context: MediaServiceContext) {
  const parsed = mediaMetadataSchema.parse(input);
  const normalizedPublicUrl = normalizeStoredPublicUrl(parsed);

  await assertMediaReferences(context.workspaceId, parsed.journeyId, parsed.stopId);

  return prisma.media.create({
    data: {
      workspaceId: context.workspaceId,
      createdByUserId: context.userId,
      journeyId: parsed.journeyId || undefined,
      stopId: parsed.stopId || undefined,
      filePath: parsed.filePath,
      publicUrl: normalizedPublicUrl,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      caption: parsed.caption,
      visibility: parsed.visibility,
    },
  });
}

export async function updateMediaMetadata(mediaId: string, input: MediaMetadataInput, workspaceId: string) {
  const existing = await prisma.media.findFirst({
    where: { id: mediaId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("media-not-found", "MEDIA_NOT_FOUND");
  }

  const parsed = mediaMetadataSchema.parse(input);
  const normalizedPublicUrl = normalizeStoredPublicUrl(parsed);

  await assertMediaReferences(workspaceId, parsed.journeyId, parsed.stopId);

  return prisma.media.update({
    where: { id: mediaId },
    data: {
      journeyId: parsed.journeyId || undefined,
      stopId: parsed.stopId || undefined,
      filePath: parsed.filePath,
      publicUrl: normalizedPublicUrl,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      caption: parsed.caption,
      visibility: parsed.visibility,
    },
  });
}

export async function deleteMedia(mediaId: string, workspaceId: string) {
  const existing = await prisma.media.findFirst({
    where: { id: mediaId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("media-not-found", "MEDIA_NOT_FOUND");
  }

  return prisma.media.delete({
    where: { id: mediaId },
  });
}

export async function deleteMediaWithStorage(mediaId: string, workspaceId: string) {
  const existing = await prisma.media.findFirst({
    where: { id: mediaId, workspaceId },
    select: {
      id: true,
      filePath: true,
    },
  });

  if (!existing) {
    throw new AppError("media-not-found", "MEDIA_NOT_FOUND");
  }

  const filePath = existing.filePath.trim();
  if (!filePath) {
    throw new AppError("media-storage-path-missing", "MEDIA_STORAGE_PATH_MISSING");
  }

  const storageService = new SupabaseStorageService();
  const serverEnv = getServerEnv();

  // Never delete metadata if storage deletion fails.
  await storageService.deleteFile({
    bucket: serverEnv.SUPABASE_STORAGE_BUCKET,
    filePath,
  });

  return prisma.media.delete({
    where: { id: mediaId },
  });
}
