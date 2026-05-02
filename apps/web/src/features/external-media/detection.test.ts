import { describe, expect, it } from "vitest";
import { ExternalMediaPlatform } from "@prisma/client";
import { buildYouTubeEmbedUrl, buildYouTubeThumbnailUrl, detectExternalMediaLink } from "@/features/external-media/detection";

describe("external media detection", () => {
  it("detects youtube watch links and derives embed metadata", () => {
    const result = detectExternalMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123");

    expect(result).toMatchObject({
      platform: ExternalMediaPlatform.YOUTUBE,
      externalId: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("detects youtube short links", () => {
    const result = detectExternalMediaLink("https://youtu.be/dQw4w9WgXcQ");

    expect(result.platform).toBe(ExternalMediaPlatform.YOUTUBE);
    expect(result.externalId).toBe("dQw4w9WgXcQ");
  });

  it("detects mobile youtube watch and embed links", () => {
    expect(detectExternalMediaLink("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=43s")).toMatchObject({
      platform: ExternalMediaPlatform.YOUTUBE,
      externalId: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
    expect(detectExternalMediaLink("https://www.youtube.com/embed/dQw4w9WgXcQ?si=share")).toMatchObject({
      platform: ExternalMediaPlatform.YOUTUBE,
      externalId: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("detects youtube shorts links", () => {
    const result = detectExternalMediaLink("https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share");

    expect(result.platform).toBe(ExternalMediaPlatform.YOUTUBE);
    expect(result.externalId).toBe("dQw4w9WgXcQ");
    expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("detects instagram reel links", () => {
    const result = detectExternalMediaLink("https://www.instagram.com/reel/C7abc123xyz/");

    expect(result).toMatchObject({
      platform: ExternalMediaPlatform.INSTAGRAM,
      externalId: "C7abc123xyz",
    });
  });

  it("detects flickr photo and short links", () => {
    expect(detectExternalMediaLink("https://www.flickr.com/photos/coburg-testing/123456789/")).toMatchObject({
      platform: ExternalMediaPlatform.FLICKR,
      externalId: "123456789",
    });
    expect(detectExternalMediaLink("https://flic.kr/p/2abcxyz")).toMatchObject({
      platform: ExternalMediaPlatform.FLICKR,
      externalId: "2abcxyz",
    });
    expect(detectExternalMediaLink("https://www.flickr.com/photos/coburg-testing/albums/72177720312345678")).toMatchObject({
      platform: ExternalMediaPlatform.FLICKR,
      externalId: "72177720312345678",
    });
    expect(detectExternalMediaLink("https://www.flickr.com/photo.gne?id=123456789")).toMatchObject({
      platform: ExternalMediaPlatform.FLICKR,
      externalId: "123456789",
    });
    expect(detectExternalMediaLink("https://www.flickr.com/photos/coburg-testing/123456789/in/dateposted-public/")).toMatchObject({
      platform: ExternalMediaPlatform.FLICKR,
      externalId: "123456789",
    });
    expect(detectExternalMediaLink("https://flic.kr/s/aHBqjBxyz1")).toMatchObject({
      platform: ExternalMediaPlatform.FLICKR,
      externalId: "aHBqjBxyz1",
    });
  });

  it("detects tiktok video links", () => {
    const result = detectExternalMediaLink("https://www.tiktok.com/@creator/video/7350123456789012345");

    expect(result).toMatchObject({
      platform: ExternalMediaPlatform.TIKTOK,
      externalId: "7350123456789012345",
    });
  });

  it("falls back to generic links for unsupported hosts", () => {
    const result = detectExternalMediaLink("https://example.com/travel/journal-entry");

    expect(result).toMatchObject({
      platform: ExternalMediaPlatform.GENERIC,
      hostname: "example.com",
    });
  });

  it("rejects unsafe url schemes", () => {
    expect(() => detectExternalMediaLink("javascript:alert('xss')")).toThrow("external-media-unsupported-url-scheme");
  });

  it("builds safe youtube embed urls", () => {
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("builds stable youtube thumbnail urls", () => {
    expect(buildYouTubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
