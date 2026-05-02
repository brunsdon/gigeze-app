import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tour: {
      findFirst: vi.fn(),
    },
    gig: {
      findFirst: vi.fn(),
    },
    media: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { mockIsDatabaseReachable, mockMarkDatabaseUnavailable, mockIsDatabaseConnectionError } = vi.hoisted(() => ({
  mockIsDatabaseReachable: vi.fn(),
  mockMarkDatabaseUnavailable: vi.fn(),
  mockIsDatabaseConnectionError: vi.fn(),
}));

const { mockGetServerEnv, mockGetSupabasePublicEnv } = vi.hoisted(() => ({
  mockGetServerEnv: vi.fn(),
  mockGetSupabasePublicEnv: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/db/availability", () => ({
  isDatabaseReachable: mockIsDatabaseReachable,
  markDatabaseUnavailable: mockMarkDatabaseUnavailable,
}));

vi.mock("@/lib/db/errors", () => ({
  isDatabaseConnectionError: mockIsDatabaseConnectionError,
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: mockGetServerEnv,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: mockGetSupabasePublicEnv,
}));

import { createMediaMetadata, deleteMedia, listPublicMediaFilterOptions, listPublicMediaItems, updateMediaMetadata } from "@/features/media/service";

describe("media service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDatabaseReachable.mockResolvedValue(true);
    mockIsDatabaseConnectionError.mockReturnValue(false);
    mockGetServerEnv.mockReturnValue({ SUPABASE_STORAGE_BUCKET: "media" });
    mockGetSupabasePublicEnv.mockReturnValue({ url: "https://project.supabase.co", anonKey: "anon-key" });
  });

  it("blocks creation when Gig does not belong to selected Tour", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.gig.findFirst.mockResolvedValue({ id: "Gig-1", journeyId: "Tour-2" });

    await expect(
      createMediaMetadata({
        journeyId: "Tour-1",
        stopId: "Gig-1",
        filePath: "Tours/a/photo.jpg",
        fileName: "photo.jpg",
        publicUrl: undefined,
        mimeType: "image/jpeg",
        sizeBytes: 123,
        caption: undefined,
        visibility: "PRIVATE",
      }, {
        workspaceId: "workspace-1",
        userId: "user-1",
      }),
    ).rejects.toEqual(expect.objectContaining({ message: "Gig-Tour-mismatch" }));

    expect(mockPrisma.media.create).not.toHaveBeenCalled();
  });

  it("throws when updating a missing media record", async () => {
    mockPrisma.media.findFirst.mockResolvedValue(null);

    await expect(
      updateMediaMetadata("missing", {
        journeyId: undefined,
        stopId: undefined,
        filePath: "Tours/a/photo.jpg",
        fileName: "photo.jpg",
        publicUrl: undefined,
        mimeType: "image/jpeg",
        sizeBytes: 123,
        caption: undefined,
        visibility: "PRIVATE",
      }, "workspace-1"),
    ).rejects.toEqual(expect.objectContaining({ message: "media-not-found", code: "MEDIA_NOT_FOUND" }));

    expect(mockPrisma.media.update).not.toHaveBeenCalled();
  });

  it("throws when deleting a missing media record", async () => {
    mockPrisma.media.findFirst.mockResolvedValue(null);

    await expect(deleteMedia("missing", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "media-not-found", code: "MEDIA_NOT_FOUND" }),
    );

    expect(mockPrisma.media.delete).not.toHaveBeenCalled();
  });

  it("returns only public-safe media context for the public gallery", async () => {
    mockPrisma.media.findMany.mockResolvedValue([
      {
        id: "media-1",
        fileName: "coast.jpg",
        publicUrl: "https://example.com/coast.jpg",
        mimeType: "image/jpeg",
        caption: "Coastline",
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        Tour: {
          id: "Tour-1",
          title: "Coast Run",
          slug: "coast-run",
          visibility: "PUBLIC",
        },
        Gig: {
          id: "Gig-1",
          title: "Byron Bay",
          journeyId: "Tour-1",
          visibility: "PUBLIC",
          Tour: {
            id: "Tour-1",
            title: "Coast Run",
            slug: "coast-run",
            visibility: "PUBLIC",
          },
        },
      },
      {
        id: "media-2",
        fileName: "private-link.jpg",
        publicUrl: "https://example.com/private-link.jpg",
        mimeType: "image/jpeg",
        caption: "Still public media",
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
        Tour: {
          id: "Tour-2",
          title: "Private Tour",
          slug: "private-Tour",
          visibility: "PRIVATE",
        },
        Gig: {
          id: "Gig-2",
          title: "Private Gig",
          journeyId: "Tour-2",
          visibility: "PRIVATE",
          Tour: {
            id: "Tour-2",
            title: "Private Tour",
            slug: "private-Tour",
            visibility: "PRIVATE",
          },
        },
      },
    ]);

    const items = await listPublicMediaItems();

    expect(items).toEqual([
      expect.objectContaining({
        id: "media-1",
        Tour: expect.objectContaining({ id: "Tour-1", title: "Coast Run" }),
        Gig: expect.objectContaining({ id: "Gig-1", title: "Byron Bay" }),
      }),
      expect.objectContaining({
        id: "media-2",
        Tour: null,
        Gig: null,
      }),
    ]);
  });

  it("builds public gallery filter options from public-safe Tour and Gig links", async () => {
    mockPrisma.media.findMany
      .mockResolvedValueOnce([
        {
          id: "media-1",
          Tour: {
            id: "Tour-1",
            title: "Coast Run",
            slug: "coast-run",
            visibility: "PUBLIC",
          },
        },
        {
          id: "media-2",
          Tour: {
            id: "Tour-1",
            title: "Coast Run",
            slug: "coast-run",
            visibility: "PUBLIC",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "media-1",
          Gig: {
            id: "Gig-1",
            title: "Byron Bay",
            journeyId: "Tour-1",
            visibility: "PUBLIC",
            Tour: {
              id: "Tour-1",
              title: "Coast Run",
              slug: "coast-run",
              visibility: "PUBLIC",
            },
          },
        },
      ]);

    const options = await listPublicMediaFilterOptions({ journeyId: "Tour-1" });

    expect(options).toEqual({
      Tours: [{ id: "Tour-1", title: "Coast Run", slug: "coast-run" }],
      Gigs: [{ id: "Gig-1", title: "Byron Bay", journeyId: "Tour-1", journeyTitle: "Coast Run" }],
    });
  });

  it("normalizes Supabase render URLs to canonical raw public object URLs on create", async () => {
    mockPrisma.media.create.mockResolvedValue({ id: "media-1" });

    await createMediaMetadata({
      filePath: "Tours/coast/photo.jpg",
      publicUrl: "https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=960",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 123,
      caption: "Coastline",
      visibility: "PUBLIC",
    }, {
      workspaceId: "workspace-1",
      userId: "user-1",
    });

    expect(mockPrisma.media.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
      }),
    }));
  });
});