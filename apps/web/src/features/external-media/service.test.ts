import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalMediaEntityType, ExternalMediaPlatform } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tour: {
      findFirst: vi.fn(),
    },
    drivingLog: {
      findFirst: vi.fn(),
    },
    gig: {
      findFirst: vi.fn(),
    },
    publicPost: {
      findFirst: vi.fn(),
    },
    externalMediaLink: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  createExternalMediaLink,
  deleteExternalMediaLink,
  listExternalMediaLinksForEntity,
  updateExternalMediaLink,
} from "@/features/external-media/service";

describe("external media service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a youtube link with derived metadata", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.externalMediaLink.create.mockResolvedValue({ id: "link-1" });

    await createExternalMediaLink(
      {
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
        url: "https://youtu.be/dQw4w9WgXcQ",
        title: "Campfire recap",
      },
      { workspaceId: "workspace-1", userId: "user-1" },
    );

    expect(mockPrisma.externalMediaLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://youtu.be/dQw4w9WgXcQ",
          platform: ExternalMediaPlatform.YOUTUBE,
          externalId: "dQw4w9WgXcQ",
          embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        }),
      }),
    );
  });

  it("allows unsupported hosts as generic links", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.externalMediaLink.create.mockResolvedValue({ id: "link-1" });

    await createExternalMediaLink(
      {
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
        url: "https://example.com/story/1",
      },
      { workspaceId: "workspace-1", userId: "user-1" },
    );

    expect(mockPrisma.externalMediaLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: ExternalMediaPlatform.GENERIC,
        }),
      }),
    );
  });

  it("creates a flickr link with oembed preview metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "photo",
        title: "Camp beside the river",
        url: "https://live.staticflickr.com/example/river_b.jpg",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.externalMediaLink.create.mockResolvedValue({ id: "link-1" });

    await createExternalMediaLink(
      {
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
        url: "https://www.flickr.com/photos/coburg-testing/123456789/",
      },
      { workspaceId: "workspace-1", userId: "user-1" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("https://www.flickr.com/services/oembed/"),
      }),
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
    expect(mockPrisma.externalMediaLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: ExternalMediaPlatform.FLICKR,
          title: "Camp beside the river",
          thumbnailUrl: "https://live.staticflickr.com/example/river_b.jpg",
        }),
      }),
    );
  });

  it("backfills missing flickr preview metadata while listing links", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Flickr Gig",
        url: "https://live.staticflickr.com/example/stop_b.jpg",
      }),
    }));
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.externalMediaLink.findMany.mockResolvedValue([
      {
        id: "link-1",
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
        url: "https://flic.kr/p/2saxhhr",
        platform: ExternalMediaPlatform.FLICKR,
        title: null,
        caption: null,
        thumbnailUrl: null,
        embedUrl: null,
        externalId: "2saxhhr",
        createdAt: new Date("2026-04-24T00:00:00.000Z"),
        updatedAt: new Date("2026-04-24T00:00:00.000Z"),
      },
    ]);
    mockPrisma.externalMediaLink.update.mockResolvedValue({ id: "link-1" });

    const result = await listExternalMediaLinksForEntity("workspace-1", ExternalMediaEntityType.Tour, "Tour-1");

    expect(result[0]).toMatchObject({
      title: "Flickr Gig",
      thumbnailUrl: "https://live.staticflickr.com/example/stop_b.jpg",
    });
    expect(mockPrisma.externalMediaLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "link-1" },
        data: {
          title: "Flickr Gig",
          thumbnailUrl: "https://live.staticflickr.com/example/stop_b.jpg",
        },
      }),
    );
  });

  it("backfills missing youtube preview metadata while listing links", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.externalMediaLink.findMany.mockResolvedValue([
      {
        id: "link-1",
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
        url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=43s",
        platform: ExternalMediaPlatform.YOUTUBE,
        title: "Road recap",
        caption: null,
        thumbnailUrl: null,
        embedUrl: null,
        externalId: null,
        createdAt: new Date("2026-04-24T00:00:00.000Z"),
        updatedAt: new Date("2026-04-24T00:00:00.000Z"),
      },
    ]);
    mockPrisma.externalMediaLink.update.mockResolvedValue({ id: "link-1" });

    const result = await listExternalMediaLinksForEntity("workspace-1", ExternalMediaEntityType.Tour, "Tour-1");

    expect(result[0]).toMatchObject({
      externalId: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
    expect(mockPrisma.externalMediaLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "link-1" },
        data: {
          externalId: "dQw4w9WgXcQ",
          embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        },
      }),
    );
  });

  it("rejects links for inaccessible entities", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue(null);

    await expect(createExternalMediaLink(
      {
        entityType: ExternalMediaEntityType.Tour,
        entityId: "Tour-1",
        url: "https://example.com/story/1",
      },
      { workspaceId: "workspace-1", userId: "user-1" },
    )).rejects.toMatchObject({
      message: "external-media-invalid-Tour-reference",
      code: "EXTERNAL_MEDIA_INVALID_JOURNEY_REFERENCE",
    });
  });

  it("lists links after checking entity access", async () => {
    mockPrisma.tour.findFirst.mockResolvedValue({ id: "Tour-1" });
    mockPrisma.externalMediaLink.findMany.mockResolvedValue([{ id: "link-1" }]);

    const result = await listExternalMediaLinksForEntity("workspace-1", ExternalMediaEntityType.Tour, "Tour-1");

    expect(result).toEqual([{ id: "link-1" }]);
    expect(mockPrisma.externalMediaLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          entityType: ExternalMediaEntityType.Tour,
          entityId: "Tour-1",
          deletedAt: null,
        }),
      }),
    );
  });

  it("updates link metadata", async () => {
    mockPrisma.externalMediaLink.findFirst.mockResolvedValue({ id: "link-1" });
    mockPrisma.externalMediaLink.update.mockResolvedValue({ id: "link-1", title: "Updated" });

    await updateExternalMediaLink("link-1", { title: "Updated", caption: "New caption" }, "workspace-1");

    expect(mockPrisma.externalMediaLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "link-1" },
        data: { title: "Updated", caption: "New caption" },
      }),
    );
  });

  it("soft deletes links instead of removing the external content", async () => {
    mockPrisma.externalMediaLink.findFirst.mockResolvedValue({ id: "link-1" });
    mockPrisma.externalMediaLink.update.mockResolvedValue({ id: "link-1", deletedAt: new Date() });

    await deleteExternalMediaLink("link-1", "workspace-1");

    expect(mockPrisma.externalMediaLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "link-1" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });
});
