const STORAGE_OBJECT_PUBLIC_PREFIX = "/storage/v1/object/public/";
const STORAGE_RENDER_PUBLIC_PREFIX = "/storage/v1/render/image/public/";

// Display variant sizes — use these constants to select size-appropriate Supabase transforms
export const THUMBNAIL_WIDTH = 400;
export const MEDIUM_WIDTH = 1200;
export const THUMB_QUALITY = 70;
export const MEDIUM_QUALITY = 80;

export type MediaDisplaySize = "thumb" | "medium" | "full";

type MediaUrlLike = {
  publicUrl?: string | null;
  filePath?: string | null;
  fileName: string;
  mimeType?: string | null;
  caption?: string | null;
  Tour?: {
    title: string;
  } | null;
};

type ResolveMediaUrlOptions = {
  bucket?: string;
  supabaseUrl?: string;
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain";
};

function parseAbsoluteUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeOrigin(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function encodeStoragePath(filePath: string) {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildStorageUrl(origin: string, prefix: string, bucketAndPath: string) {
  return `${origin}${prefix}${bucketAndPath}`;
}

function getSupabaseBucketAndPath(url: URL, supabaseOrigin?: string | null) {
  if (supabaseOrigin && url.origin !== supabaseOrigin) {
    return null;
  }

  if (url.pathname.startsWith(STORAGE_OBJECT_PUBLIC_PREFIX)) {
    return url.pathname.slice(STORAGE_OBJECT_PUBLIC_PREFIX.length);
  }

  if (url.pathname.startsWith(STORAGE_RENDER_PUBLIC_PREFIX)) {
    return url.pathname.slice(STORAGE_RENDER_PUBLIC_PREFIX.length);
  }

  return null;
}

export function isPublicMediaImageLike(item: Pick<MediaUrlLike, "publicUrl" | "fileName" | "mimeType">) {
  const source = item.publicUrl ?? item.fileName;
  return Boolean(item.mimeType?.startsWith("image/") || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(source));
}

export function buildSupabasePublicObjectUrl(filePath: string, options: Pick<ResolveMediaUrlOptions, "bucket" | "supabaseUrl">) {
  const supabaseOrigin = normalizeOrigin(options.supabaseUrl);
  const bucket = options.bucket?.trim();
  const normalizedPath = filePath.trim();

  if (!supabaseOrigin || !bucket || !normalizedPath) {
    return null;
  }

  return buildStorageUrl(supabaseOrigin, STORAGE_OBJECT_PUBLIC_PREFIX, `${encodeURIComponent(bucket)}/${encodeStoragePath(normalizedPath)}`);
}

export function resolvePublicMediaRawUrl(item: Pick<MediaUrlLike, "publicUrl" | "filePath" | "fileName" | "mimeType">, options: Pick<ResolveMediaUrlOptions, "bucket" | "supabaseUrl"> = {}) {
  const canonicalFromFilePath = item.filePath
    ? buildSupabasePublicObjectUrl(item.filePath, options)
    : null;

  const parsedPublicUrl = parseAbsoluteUrl(item.publicUrl);
  const supabaseOrigin = normalizeOrigin(options.supabaseUrl);

  if (parsedPublicUrl) {
    const bucketAndPath = getSupabaseBucketAndPath(parsedPublicUrl, supabaseOrigin);
    if (bucketAndPath) {
      return buildStorageUrl(parsedPublicUrl.origin, STORAGE_OBJECT_PUBLIC_PREFIX, bucketAndPath);
    }

    return canonicalFromFilePath ?? parsedPublicUrl.toString();
  }

  return canonicalFromFilePath;
}

export function resolvePublicMediaPreviewUrls(item: Pick<MediaUrlLike, "publicUrl" | "filePath" | "fileName" | "mimeType">, options: ResolveMediaUrlOptions = {}) {
  if (!isPublicMediaImageLike(item)) {
    return [];
  }

  const canonicalFromFilePath = item.filePath
    ? buildSupabasePublicObjectUrl(item.filePath, options)
    : null;
  const normalizedFromPublicUrl = resolvePublicMediaRawUrl({ ...item, filePath: undefined }, options);

  const rawUrl = canonicalFromFilePath ?? normalizedFromPublicUrl;
  if (!rawUrl && !normalizedFromPublicUrl) {
    return [];
  }

  const rawCandidates = Array.from(new Set([rawUrl, normalizedFromPublicUrl].filter((value): value is string => Boolean(value))));

  const candidates: string[] = [];
  for (const rawCandidate of rawCandidates) {
    const parsedRawUrl = parseAbsoluteUrl(rawCandidate);
    const bucketAndPath = parsedRawUrl ? getSupabaseBucketAndPath(parsedRawUrl, normalizeOrigin(options.supabaseUrl)) : null;

    if (parsedRawUrl && bucketAndPath) {
      const transformedUrl = new URL(buildStorageUrl(parsedRawUrl.origin, STORAGE_RENDER_PUBLIC_PREFIX, bucketAndPath));
      if (options.width) {
        transformedUrl.searchParams.set("width", String(options.width));
      }
      if (options.height) {
        transformedUrl.searchParams.set("height", String(options.height));
      }
      if (options.resize) {
        transformedUrl.searchParams.set("resize", options.resize);
      }
      if (options.quality) {
        transformedUrl.searchParams.set("quality", String(options.quality));
      }

      candidates.push(transformedUrl.toString());
    }

    candidates.push(rawCandidate);
  }

  return Array.from(new Set(candidates));
}

export function resolvePublicMediaUrl(item: Pick<MediaUrlLike, "publicUrl" | "filePath" | "fileName" | "mimeType">, options: ResolveMediaUrlOptions = {}) {
  return resolvePublicMediaPreviewUrls(item, options)[0] ?? null;
}

/**
 * Convenience wrapper that resolves a size-appropriate URL for a given display context:
 * - "thumb"  → Supabase transform at THUMBNAIL_WIDTH with THUMB_QUALITY (gallery grids)
 * - "medium" → Supabase transform at MEDIUM_WIDTH with MEDIUM_QUALITY (hero banners, Tour cards)
 * - "full"   → raw original object URL with no transform (lightbox)
 *
 * Falls back to the raw object URL when the transform endpoint is unreachable.
 */
export function resolvePublicMediaUrlBySize(
  item: Pick<MediaUrlLike, "publicUrl" | "filePath" | "fileName" | "mimeType">,
  size: MediaDisplaySize,
  options: Pick<ResolveMediaUrlOptions, "bucket" | "supabaseUrl"> = {},
) {
  if (size === "full") {
    return resolvePublicMediaRawUrl(item, options);
  }

  return resolvePublicMediaUrl(item, {
    ...options,
    width: size === "thumb" ? THUMBNAIL_WIDTH : MEDIUM_WIDTH,
    resize: "cover",
    quality: size === "thumb" ? THUMB_QUALITY : MEDIUM_QUALITY,
  });
}

export function getPublicMediaDisplayTitle(item: Pick<MediaUrlLike, "caption">) {
  const caption = item.caption?.trim();
  return caption || "Untitled media";
}

export function getPublicMediaAltText(item: Pick<MediaUrlLike, "caption" | "fileName" | "Tour">) {
  const caption = item.caption?.trim();
  if (caption) {
    return caption;
  }

  const journeyTitle = item.Tour?.title?.trim();
  if (journeyTitle) {
    return `${journeyTitle} media preview`;
  }

  return journeyTitle ? `${journeyTitle} media` : "Media preview";
}
