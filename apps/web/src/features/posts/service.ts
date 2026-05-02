import { PublicPostStatus, type Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseReachable, markDatabaseUnavailable } from "@/lib/db/availability";
import { type PublicPostCreateInput, type PublicPostUpdateInput } from "@/lib/validation";
import { AppError } from "@/lib/utils/app-error";
import { slugify } from "@/lib/utils/slugify";
import { isDatabaseConnectionError } from "@/lib/db/errors";

export type PostServiceContext = {
  workspaceId: string;
  userId: string;
};

function sanitizePublicPostRelations<T extends {
  Tour: { visibility: Visibility } | null;
  Gig: { visibility: Visibility; Tour: { visibility: Visibility } | null } | null;
}>(post: T): T {
  const Tour = post.Tour?.visibility === "PUBLIC" ? post.Tour : null;
  const Gig =
    post.Gig?.visibility === "PUBLIC" && post.Gig.Tour?.visibility === "PUBLIC" ? post.Gig : null;

  return {
    ...post,
    Tour,
    Gig,
  };
}

function sanitizeSharedPostRelations<T extends {
  Tour: { visibility: Visibility } | null;
  Gig: { visibility: Visibility; Tour: { visibility: Visibility } | null } | null;
}>(post: T): T {
  const allowedVisibility: Visibility[] = ["SHARED", "PUBLIC"];
  const Tour = post.Tour && allowedVisibility.includes(post.Tour.visibility) ? post.Tour : null;
  const Gig =
    post.Gig &&
    allowedVisibility.includes(post.Gig.visibility) &&
    post.Gig.Tour &&
    allowedVisibility.includes(post.Gig.Tour.visibility)
      ? post.Gig
      : null;

  return {
    ...post,
    Tour,
    Gig,
  };
}

async function assertJourneyStopReferences(workspaceId: string, journeyId?: string, stopId?: string) {
  let stopJourneyId: string | undefined;

  if (journeyId) {
    const Tour = await prisma.tour.findFirst({
      where: { id: journeyId, workspaceId },
      select: { id: true },
    });

    if (!Tour) {
      throw new AppError("post-invalid-Tour-reference", "POST_INVALID_JOURNEY_REFERENCE");
    }
  }

  if (stopId) {
    const Gig = await prisma.gig.findFirst({
      where: { id: stopId, workspaceId },
      select: { id: true, journeyId: true },
    });

    if (!Gig) {
      throw new AppError("post-invalid-Gig-reference", "POST_INVALID_STOP_REFERENCE");
    }

    stopJourneyId = Gig.journeyId;
  }

  if (journeyId && stopJourneyId && journeyId !== stopJourneyId) {
    throw new AppError("post-Gig-Tour-mismatch", "POST_STOP_JOURNEY_MISMATCH");
  }
}

async function ensureUniquePostSlug(base: string, excludePostId?: string) {
  let slug = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.publicPost.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || existing.id === excludePostId) {
      return slug;
    }

    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function buildBasePostSlug(title: string, customSlug?: string) {
  const candidate = slugify(customSlug?.length ? customSlug : title);
  return candidate.length ? candidate : "untitled-post";
}

function toPostStatusData(status: PublicPostStatus) {
  if (status === PublicPostStatus.PUBLISHED) {
    return {
      status,
      publishedAt: new Date(),
    };
  }

  return {
    status,
    publishedAt: null,
  };
}

export async function listPostsForWorkspace(workspaceId: string) {
  return prisma.publicPost.findMany({
    where: { workspaceId },
    include: {
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
          visibility: true,
          journeyId: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function listPublishedPosts(limit?: number) {
  if (!(await isDatabaseReachable())) {
    return [];
  }

  try {
    const posts = await prisma.publicPost.findMany({
      where: {
        status: PublicPostStatus.PUBLISHED,
        visibility: "PUBLIC",
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
            locationName: true,
            visibility: true,
            journeyId: true,
            Tour: {
              select: {
                id: true,
                slug: true,
                visibility: true,
              },
            },
          },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });

    return posts.map((post) => sanitizePublicPostRelations(post));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      markDatabaseUnavailable();
      return [];
    }

    throw error;
  }
}

export async function listLatestPublishedPosts(limit = 3) {
  return listPublishedPosts(limit);
}

export async function getPostByIdForWorkspace(postId: string, workspaceId: string) {
  return prisma.publicPost.findFirst({
    where: { id: postId, workspaceId },
    include: {
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
          locationName: true,
          visibility: true,
          journeyId: true,
        },
      },
    },
  });
}

export async function getPublishedPostBySlug(slug: string) {
  const post = await prisma.publicPost.findFirst({
    where: {
      slug,
      status: PublicPostStatus.PUBLISHED,
      visibility: "PUBLIC",
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
          locationName: true,
          visibility: true,
          journeyId: true,
          Tour: {
            select: {
              id: true,
              slug: true,
              visibility: true,
            },
          },
        },
      },
    },
  });

  if (!post) {
    return null;
  }

  return sanitizePublicPostRelations(post);
}

export async function createPost(input: PublicPostCreateInput, context: PostServiceContext) {
  await assertJourneyStopReferences(context.workspaceId, input.journeyId, input.stopId);

  const baseSlug = buildBasePostSlug(input.title, input.slug);
  const slug = await ensureUniquePostSlug(baseSlug);

  return prisma.publicPost.create({
    data: {
      workspaceId: context.workspaceId,
      createdByUserId: context.userId,
      title: input.title,
      slug,
      excerpt: input.excerpt,
      content: input.content,
      coverImageUrl: input.coverImageUrl,
      visibility: input.visibility,
      journeyId: input.journeyId,
      stopId: input.stopId,
      ...toPostStatusData(input.status ?? PublicPostStatus.DRAFT),
    },
  });
}

export async function updatePost(postId: string, input: PublicPostUpdateInput, workspaceId: string) {
  const existing = await prisma.publicPost.findFirst({
    where: { id: postId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("post-not-found", "POST_NOT_FOUND");
  }

  await assertJourneyStopReferences(workspaceId, input.journeyId, input.stopId);

  const baseSlug = buildBasePostSlug(input.title, input.slug);
  const slug = await ensureUniquePostSlug(baseSlug, postId);

  return prisma.publicPost.update({
    where: { id: postId },
    data: {
      title: input.title,
      slug,
      excerpt: input.excerpt,
      content: input.content,
      coverImageUrl: input.coverImageUrl,
      visibility: input.visibility,
      journeyId: input.journeyId,
      stopId: input.stopId,
      ...toPostStatusData(input.status ?? PublicPostStatus.DRAFT),
    },
  });
}

export async function deletePost(postId: string, workspaceId: string) {
  const existing = await prisma.publicPost.findFirst({
    where: { id: postId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("post-not-found", "POST_NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    await tx.externalMediaLink.updateMany({
      where: {
        workspaceId,
        entityType: "STORY",
        entityId: postId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return tx.publicPost.delete({
      where: { id: postId },
    });
  });
}

export async function publishPost(postId: string, workspaceId: string) {
  const existing = await prisma.publicPost.findFirst({
    where: { id: postId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("post-not-found", "POST_NOT_FOUND");
  }

  return prisma.publicPost.update({
    where: { id: postId },
    data: {
      status: PublicPostStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
}

export async function unpublishPost(postId: string, workspaceId: string) {
  const existing = await prisma.publicPost.findFirst({
    where: { id: postId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("post-not-found", "POST_NOT_FOUND");
  }

  return prisma.publicPost.update({
    where: { id: postId },
    data: {
      status: PublicPostStatus.DRAFT,
      publishedAt: null,
    },
  });
}

export async function listSharedPostsForViewer(workspaceId: string) {
  return prisma.publicPost.findMany({
    where: {
      workspaceId,
      status: PublicPostStatus.PUBLISHED,
      visibility: { in: ["SHARED", "PUBLIC"] },
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getSharedPostBySlugForViewer(workspaceId: string, slug: string) {
  const post = await prisma.publicPost.findFirst({
    where: {
      workspaceId,
      slug,
      status: PublicPostStatus.PUBLISHED,
      visibility: { in: ["SHARED", "PUBLIC"] },
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
      Gig: {
        select: {
          id: true,
          title: true,
          locationName: true,
          visibility: true,
          journeyId: true,
          Tour: {
            select: {
              id: true,
              slug: true,
              visibility: true,
            },
          },
        },
      },
    },
  });

  if (!post) {
    return null;
  }

  return sanitizeSharedPostRelations(post);
}
