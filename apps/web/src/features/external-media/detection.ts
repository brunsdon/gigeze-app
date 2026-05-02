import { ExternalMediaPlatform } from "@prisma/client";
import { AppError } from "@/lib/utils/app-error";

export type ExternalMediaDetectionResult = {
  normalizedUrl: string;
  platform: ExternalMediaPlatform;
  externalId?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  hostname: string;
};

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

function toUrl(input: string) {
  try {
    return new URL(input);
  } catch {
    throw new AppError("external-media-invalid-url", "EXTERNAL_MEDIA_INVALID_URL");
  }
}

function normalizeVideoId(value: string) {
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{6,20}$/.test(trimmed) ? trimmed : undefined;
}

export function buildYouTubeEmbedUrl(videoId: string) {
  const normalizedVideoId = normalizeVideoId(videoId);
  if (!normalizedVideoId) {
    throw new AppError("external-media-invalid-youtube-id", "EXTERNAL_MEDIA_INVALID_YOUTUBE_ID");
  }

  return `https://www.youtube-nocookie.com/embed/${normalizedVideoId}`;
}

export function buildYouTubeThumbnailUrl(videoId: string) {
  const normalizedVideoId = normalizeVideoId(videoId);
  if (!normalizedVideoId) {
    throw new AppError("external-media-invalid-youtube-id", "EXTERNAL_MEDIA_INVALID_YOUTUBE_ID");
  }

  return `https://i.ytimg.com/vi/${normalizedVideoId}/hqdefault.jpg`;
}

function detectYouTube(url: URL): ExternalMediaDetectionResult | null {
  const hostname = url.hostname.toLowerCase();
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (!hostname.includes("youtube.com") && hostname !== "youtu.be" && hostname !== "www.youtu.be") {
    return null;
  }

  const candidates = [
    hostname.endsWith("youtu.be") ? pathSegments[0] : undefined,
    hostname.includes("youtube.com") ? url.searchParams.get("v") ?? undefined : undefined,
    pathSegments[0] === "shorts" ? pathSegments[1] : undefined,
    pathSegments[0] === "embed" ? pathSegments[1] : undefined,
  ];

  const externalId = candidates.map((candidate) => candidate && normalizeVideoId(candidate)).find(Boolean);

  return {
    normalizedUrl: url.toString(),
    platform: ExternalMediaPlatform.YOUTUBE,
    externalId,
    embedUrl: externalId ? buildYouTubeEmbedUrl(externalId) : undefined,
    thumbnailUrl: externalId ? buildYouTubeThumbnailUrl(externalId) : undefined,
    hostname,
  };
}

function detectInstagram(url: URL): ExternalMediaDetectionResult | null {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("instagram.com")) {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const isSupportedPath = pathSegments[0] === "p" || pathSegments[0] === "reel" || pathSegments[0] === "tv";

  return {
    normalizedUrl: url.toString(),
    platform: ExternalMediaPlatform.INSTAGRAM,
    externalId: isSupportedPath ? pathSegments[1] : undefined,
    hostname,
  };
}

function detectTikTok(url: URL): ExternalMediaDetectionResult | null {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("tiktok.com")) {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const videoIndex = pathSegments.findIndex((segment) => segment === "video");

  return {
    normalizedUrl: url.toString(),
    platform: ExternalMediaPlatform.TIKTOK,
    externalId: videoIndex >= 0 ? pathSegments[videoIndex + 1] : undefined,
    hostname,
  };
}

function detectFacebook(url: URL): ExternalMediaDetectionResult | null {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("facebook.com") && hostname !== "fb.watch") {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const postsIndex = pathSegments.findIndex((segment) => segment === "posts");
  const watchVideoId = url.searchParams.get("v") ?? undefined;

  return {
    normalizedUrl: url.toString(),
    platform: ExternalMediaPlatform.FACEBOOK,
    externalId:
      watchVideoId ||
      (hostname === "fb.watch" ? pathSegments[0] : undefined) ||
      (postsIndex >= 0 ? pathSegments[postsIndex + 1] : undefined),
    hostname,
  };
}

function detectFlickr(url: URL): ExternalMediaDetectionResult | null {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("flickr.com") && hostname !== "flic.kr") {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const searchPhotoId = url.searchParams.get("id") ?? undefined;
  const externalId =
    hostname === "flic.kr"
      ? pathSegments[1]
      : searchPhotoId
        ? searchPhotoId
      : pathSegments[0] === "photos"
        ? pathSegments[2] === "albums"
          ? pathSegments[3]
          : pathSegments[2]
        : undefined;

  return {
    normalizedUrl: url.toString(),
    platform: ExternalMediaPlatform.FLICKR,
    externalId,
    hostname,
  };
}

export function detectExternalMediaLink(input: string): ExternalMediaDetectionResult {
  const url = toUrl(input.trim());

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new AppError("external-media-unsupported-url-scheme", "EXTERNAL_MEDIA_UNSUPPORTED_URL_SCHEME");
  }

  const detection =
    detectFlickr(url) ??
    detectYouTube(url) ??
    detectInstagram(url) ??
    detectTikTok(url) ??
    detectFacebook(url);

  if (detection) {
    return detection;
  }

  return {
    normalizedUrl: url.toString(),
    platform: ExternalMediaPlatform.GENERIC,
    hostname: url.hostname.toLowerCase(),
  };
}
