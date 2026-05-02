"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingIndicator } from "@/components/ui/loading-state";
import {
  getPublicMediaAltText,
  getPublicMediaDisplayTitle,
  THUMBNAIL_WIDTH,
  THUMB_QUALITY,
  type MediaDisplaySize,
  resolvePublicMediaUrlBySize,
  resolvePublicMediaPreviewUrls,
  resolvePublicMediaRawUrl,
  resolvePublicMediaUrl,
} from "@/features/media/public-url";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const IS_DEV = process.env.NODE_ENV !== "production";

export type PublicMediaRenderable = {
  id: string;
  filePath?: string | null;
  fileName: string;
  publicUrl?: string | null;
  mimeType?: string | null;
  caption?: string | null;
  createdAt?: Date;
  Tour?: {
    title: string;
  } | null;
};

type PublicMediaPreviewProps = {
  item: PublicMediaRenderable;
  context: "grid" | "lightbox" | "hero";
  /** When set to "full", the raw object URL is used with no Supabase transform (suitable for lightbox). */
  displaySize?: MediaDisplaySize;
  width: number;
  height: number;
  resize: "cover" | "contain";
  quality?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  placeholderLabel?: string;
  onAllSourcesFailed?: () => void;
};

type PublicMediaCardProps = {
  item: PublicMediaRenderable & { createdAt: Date };
  onSelect: () => void;
  children?: ReactNode;
  buttonClassName?: string;
  cardClassName?: string;
  previewContainerClassName?: string;
  previewClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
};

function passthroughImageLoader({ src }: ImageLoaderProps) {
  return src;
}

function getFallbackStage(url: string) {
  if (url.includes("/storage/v1/render/image/public/")) {
    return "transformed";
  }

  if (url.includes("/storage/v1/object/public/")) {
    return "raw";
  }

  return "external";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

export function PreviewUnavailable({ label = "Preview unavailable" }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(239,231,219,0.45))] text-muted-foreground">
      <ImageIcon className="size-8" />
      <span className="px-4 text-center text-xs">{label}</span>
    </div>
  );
}

export function PublicMediaPreview({
  item,
  context,
  displaySize,
  width,
  height,
  resize,
  quality = 70,
  sizes,
  priority = false,
  className,
  placeholderLabel,
  onAllSourcesFailed,
}: PublicMediaPreviewProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [slowLoadingSource, setSlowLoadingSource] = useState<string | null>(null);
  const missingSourceLoggedRef = useRef(false);
  const supabaseUrl = useMemo(() => getSupabasePublicEnv().url, []);
  const preferredSource = useMemo(
    () =>
      displaySize === "full"
        ? resolvePublicMediaRawUrl(item, { supabaseUrl })
        : resolvePublicMediaUrl(item, { supabaseUrl, width, height, resize, quality }),
    [displaySize, height, item, quality, resize, supabaseUrl, width],
  );
  const previewSources = useMemo(() => {
    if (displaySize === "full") {
      const rawUrl = resolvePublicMediaRawUrl(item, { supabaseUrl });
      return rawUrl ? [rawUrl] : [];
    }

    const candidates = resolvePublicMediaPreviewUrls(item, {
      supabaseUrl,
      width,
      height,
      resize,
      quality,
    });

    if (!preferredSource) {
      return candidates;
    }

    return [preferredSource, ...candidates.filter((candidate) => candidate !== preferredSource)];
  }, [displaySize, height, item, preferredSource, quality, resize, supabaseUrl, width]);

  const activeSource = previewSources[sourceIndex] ?? null;
  const imageLoaded = loadedSource === activeSource;
  const showSlowLoadingIndicator = slowLoadingSource === activeSource;
  const thumbPlaceholderSource = useMemo(() => {
    if (displaySize === "thumb") {
      return null;
    }

    return resolvePublicMediaUrlBySize(item, "thumb", { supabaseUrl });
  }, [displaySize, item, supabaseUrl]);

  useEffect(() => {
    if (!activeSource || imageLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSlowLoadingSource(activeSource);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [activeSource, imageLoaded]);

  useEffect(() => {
    if (!IS_DEV) {
      return;
    }

    if (!activeSource) {
      if (!missingSourceLoggedRef.current) {
        console.info("[gallery] preview placeholder", {
          context,
          mediaId: item.id,
          reason: "resolver-returned-null",
        });
        missingSourceLoggedRef.current = true;
      }
      return;
    }

    missingSourceLoggedRef.current = false;
  }, [activeSource, context, item.id]);

  if (!activeSource || imageFailed) {
    return <PreviewUnavailable label={placeholderLabel} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(239,231,219,0.3))]">
      {thumbPlaceholderSource ? (
        // The placeholder image is intentionally blurred and scaled as a low-quality preview.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbPlaceholderSource}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full scale-[1.05] object-cover blur-md transition-opacity duration-250",
            imageLoaded ? "opacity-0" : "opacity-100",
          )}
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-muted/45 transition-opacity duration-250",
            imageLoaded ? "opacity-0" : "opacity-100",
          )}
        />
      )}

      {!imageLoaded && showSlowLoadingIndicator ? (
        <div className="absolute right-2.5 bottom-2.5 z-10 rounded-full border border-border/70 bg-card/88 px-2 py-1 shadow-sm backdrop-blur-sm">
          <LoadingIndicator size="sm" className="text-[11px]" label="Loading" />
        </div>
      ) : null}

      <Image
        key={activeSource}
        loader={passthroughImageLoader}
        src={activeSource}
        alt={getPublicMediaAltText(item)}
        width={width}
        height={height}
        unoptimized
        sizes={sizes}
        priority={priority}
        className={cn(className, "transition-[opacity,transform] duration-300 ease-out", imageLoaded ? "scale-100 opacity-100" : "scale-[1.015] opacity-0")}
        onLoad={() => {
          setLoadedSource(activeSource);
          setSlowLoadingSource(null);
        }}
        onError={() => {
          if (IS_DEV) {
            console.warn("[gallery] preview failed", {
              context,
              mediaId: item.id,
              failedUrl: activeSource,
              stage: getFallbackStage(activeSource),
            });
          }

          if (sourceIndex < previewSources.length - 1) {
            setSourceIndex(sourceIndex + 1);
            return;
          }

          setImageFailed(true);
          onAllSourcesFailed?.();
        }}
      />
    </div>
  );
}

export function PublicMediaCard({
  item,
  onSelect,
  children,
  buttonClassName,
  cardClassName,
  previewContainerClassName,
  previewClassName,
  contentClassName,
  titleClassName,
}: PublicMediaCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("rounded-3xl text-left outline-none transition-transform duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 hover:-translate-y-0.5", buttonClassName)}
    >
      <Card className={cardClassName}>
        <div className={cn("relative aspect-square overflow-hidden bg-muted/30", previewContainerClassName)}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(43,42,40,0.05))]" />
          <PublicMediaPreview
            key={`${item.id}-grid`}
            item={item}
            context="grid"
            displaySize="thumb"
            width={THUMBNAIL_WIDTH}
            height={THUMBNAIL_WIDTH}
            resize="cover"
            quality={THUMB_QUALITY}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className={cn("h-full w-full object-cover", previewClassName)}
          />
        </div>
        <CardContent className={contentClassName}>
          <p className={cn("line-clamp-2 text-[0.98rem] leading-snug font-semibold tracking-tight text-foreground/95", titleClassName)}>{getPublicMediaDisplayTitle(item)}</p>
          <p className="text-xs text-muted-foreground/90">{formatDate(item.createdAt)}</p>
          {children}
        </CardContent>
      </Card>
    </button>
  );
}
