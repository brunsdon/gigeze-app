import { describe, expect, it } from "vitest";
import {
  buildSupabasePublicObjectUrl,
  getPublicMediaAltText,
  getPublicMediaDisplayTitle,
  MEDIUM_QUALITY,
  MEDIUM_WIDTH,
  resolvePublicMediaPreviewUrls,
  resolvePublicMediaRawUrl,
  resolvePublicMediaUrl,
  resolvePublicMediaUrlBySize,
  THUMB_QUALITY,
  THUMBNAIL_WIDTH,
} from "@/features/media/public-url";

describe("public media url helpers", () => {
  it("builds canonical Supabase public object URLs from bucket and file path", () => {
    expect(
      buildSupabasePublicObjectUrl("Tours/coast run/photo 1.jpg", {
        bucket: "media",
        supabaseUrl: "https://project.supabase.co",
      }),
    ).toBe("https://project.supabase.co/storage/v1/object/public/media/Tours/coast%20run/photo%201.jpg");
  });

  it("builds transformed preview first and raw object URL second for Supabase media", () => {
    expect(
      resolvePublicMediaPreviewUrls({
        publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
      }, {
        supabaseUrl: "https://project.supabase.co",
        width: 960,
        height: 960,
        resize: "cover",
        quality: 70,
      }),
    ).toEqual([
      "https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=960&height=960&resize=cover&quality=70",
      "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
    ]);
  });

  it("returns the preferred preview URL and null when no safe source exists", () => {
    expect(
      resolvePublicMediaUrl({
        publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
      }, {
        supabaseUrl: "https://project.supabase.co",
        width: 960,
        height: 960,
        resize: "cover",
      }),
    ).toBe("https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=960&height=960&resize=cover");

    expect(
      resolvePublicMediaUrl({
        publicUrl: null,
        filePath: null,
        fileName: "download.jpg",
        mimeType: "image/jpeg",
      }, {
        supabaseUrl: "https://project.supabase.co",
        bucket: "media",
      }),
    ).toBeNull();
  });

  it("normalizes a stored Supabase render URL back to the canonical raw object URL", () => {
    expect(
      resolvePublicMediaRawUrl({
        publicUrl: "https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=960",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
      }, {
        supabaseUrl: "https://project.supabase.co",
      }),
    ).toBe("https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg");
  });

  it("prefers canonical filePath-derived raw URL when a stored external public URL is invalid", () => {
    expect(
      resolvePublicMediaRawUrl({
        publicUrl: "https://broken.example.com/download.jpg",
        filePath: "Tours/coast/photo.jpg",
        fileName: "download.jpg",
        mimeType: "image/jpeg",
      }, {
        supabaseUrl: "https://project.supabase.co",
        bucket: "media",
      }),
    ).toBe("https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg");
  });

  it("does not use file name as alt fallback", () => {
    expect(
      getPublicMediaAltText({
        fileName: "download.jpg",
        caption: null,
        Tour: null,
      }),
    ).toBe("Media preview");
  });

  it("uses a neutral title when caption is missing", () => {
    expect(getPublicMediaDisplayTitle({ caption: "  Ocean lookout  " })).toBe("Ocean lookout");
    expect(getPublicMediaDisplayTitle({ caption: null })).toBe("Untitled media");
  });
});

describe("resolvePublicMediaUrlBySize", () => {
  const supabaseMediaItem = {
    publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
  };

  it("thumb returns Supabase render URL at THUMBNAIL_WIDTH with THUMB_QUALITY", () => {
    const url = resolvePublicMediaUrlBySize(supabaseMediaItem, "thumb", {
      supabaseUrl: "https://project.supabase.co",
    });
    expect(url).toBe(
      `https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=${THUMBNAIL_WIDTH}&resize=cover&quality=${THUMB_QUALITY}`,
    );
  });

  it("medium returns Supabase render URL at MEDIUM_WIDTH with MEDIUM_QUALITY", () => {
    const url = resolvePublicMediaUrlBySize(supabaseMediaItem, "medium", {
      supabaseUrl: "https://project.supabase.co",
    });
    expect(url).toBe(
      `https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=${MEDIUM_WIDTH}&resize=cover&quality=${MEDIUM_QUALITY}`,
    );
  });

  it("full returns the raw object URL with no transform parameters", () => {
    const url = resolvePublicMediaUrlBySize(supabaseMediaItem, "full", {
      supabaseUrl: "https://project.supabase.co",
    });
    expect(url).toBe(
      "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
    );
    expect(url).not.toContain("render");
    expect(url).not.toContain("width=");
  });

  it("full normalises a stored render URL back to the raw object URL", () => {
    const url = resolvePublicMediaUrlBySize(
      {
        publicUrl: "https://project.supabase.co/storage/v1/render/image/public/media/Tours/coast/photo.jpg?width=960",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
      },
      "full",
      { supabaseUrl: "https://project.supabase.co" },
    );
    expect(url).toBe(
      "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/photo.jpg",
    );
  });

  it("returns null when no valid source exists", () => {
    expect(
      resolvePublicMediaUrlBySize(
        { publicUrl: null, filePath: null, fileName: "photo.jpg", mimeType: "image/jpeg" },
        "thumb",
        { supabaseUrl: "https://project.supabase.co" },
      ),
    ).toBeNull();
  });
});
