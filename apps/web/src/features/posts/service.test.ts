import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicPostStatus } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tour: {
      findFirst: vi.fn(),
    },
    gig: {
      findFirst: vi.fn(),
    },
    publicPost: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import { createPost, getPublishedPostBySlug, updatePost } from "@/features/posts/service";

describe("posts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a unique slug by appending a numeric suffix when needed", async () => {
    mockPrisma.publicPost.findUnique
      .mockResolvedValueOnce({ id: "post-1" })
      .mockResolvedValueOnce(null);
    mockPrisma.publicPost.create.mockResolvedValue({ id: "post-2", slug: "my-trip-1" });

    await createPost({
      title: "My Trip",
      slug: "my-trip",
      excerpt: "Trip excerpt",
      content: "This is enough content for the post body.",
      status: PublicPostStatus.DRAFT,
      visibility: "PRIVATE",
      coverImageUrl: undefined,
      journeyId: undefined,
      stopId: undefined,
    }, { workspaceId: "workspace-1", userId: "user-1" });

    expect(mockPrisma.publicPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "my-trip-1",
          status: PublicPostStatus.DRAFT,
          publishedAt: null,
        }),
      }),
    );
  });

  it("blocks updates when the linked Gig does not belong to the selected Tour", async () => {
    mockPrisma.publicPost.findFirst.mockResolvedValueOnce({ id: "post-1" });
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.gig.findFirst.mockResolvedValue({ id: "Gig-1", journeyId: "Tour-2" });

    await expect(
      updatePost("post-1", {
        title: "Mismatch",
        slug: "mismatch",
        excerpt: undefined,
        content: "This update should fail because the Gig is on another Tour.",
        status: PublicPostStatus.DRAFT,
        visibility: "PRIVATE",
        coverImageUrl: undefined,
        journeyId: "Tour-1",
        stopId: "Gig-1",
      }, "workspace-1"),
    ).rejects.toEqual(expect.objectContaining({ message: "post-Gig-Tour-mismatch" }));

    expect(mockPrisma.publicPost.update).not.toHaveBeenCalled();
  });

  it("queries published posts by slug only", async () => {
    mockPrisma.publicPost.findFirst.mockResolvedValue({ id: "post-1", slug: "coastal-update" });

    await getPublishedPostBySlug("coastal-update");

    expect(mockPrisma.publicPost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: "coastal-update",
          status: PublicPostStatus.PUBLISHED,
          visibility: "PUBLIC",
        },
      }),
    );
  });

  it("falls back to an untitled slug when title and custom slug collapse to empty", async () => {
    mockPrisma.publicPost.findUnique.mockResolvedValueOnce(null);
    mockPrisma.publicPost.create.mockResolvedValue({ id: "post-3", slug: "untitled-post" });

    await createPost({
      title: "!!!",
      slug: undefined,
      excerpt: undefined,
      content: "This post still has enough content for body validation.",
      status: PublicPostStatus.DRAFT,
      visibility: "PRIVATE",
      coverImageUrl: undefined,
      journeyId: undefined,
      stopId: undefined,
    }, { workspaceId: "workspace-1", userId: "user-1" });

    expect(mockPrisma.publicPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "untitled-post",
        }),
      }),
    );
  });
});