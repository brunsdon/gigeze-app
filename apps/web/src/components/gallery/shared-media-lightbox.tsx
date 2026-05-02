"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { type Visibility } from "@prisma/client";
import { PublicMediaPreview } from "@/components/gallery/public-media-card";
import { getPublicMediaDisplayTitle } from "@/features/media/public-url";

export type SharedGalleryMediaItem = {
  id: string;
  filePath?: string | null;
  fileName: string;
  publicUrl: string | null;
  mimeType: string | null;
  caption: string | null;
  createdAt: Date;
  visibility: Visibility;
  Tour: {
    id: string;
    title: string;
    slug: string;
  } | null;
  Gig: {
    id: string;
    title: string;
  } | null;
};

type SharedMediaLightboxProps = {
  item: SharedGalleryMediaItem | null;
  workspaceSlug: string;
  onClose: () => void;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

export function SharedMediaLightbox({ item, workspaceSlug, onClose }: SharedMediaLightboxProps) {
  useEffect(() => {
    if (!item) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2a28]/65 p-4" role="dialog" aria-modal="true">
      <button aria-label="Close gallery viewer" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-10 grid max-h-[90vh] w-full max-w-5xl gap-4 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-lg lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-h-72 items-center justify-center bg-muted/35">
          <PublicMediaPreview
            key={item.id}
            item={item}
            context="lightbox"
            displaySize="full"
            width={1800}
            height={1200}
            resize="contain"
            sizes="100vw"
            priority
            className="max-h-[70vh] w-full object-contain"
            placeholderLabel="Preview unavailable for this media item."
          />
        </div>

        <div className="flex flex-col gap-4 border-t border-border/70 p-5 lg:border-t-0 lg:border-l">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline">Viewer Mode</Badge>
              <h2 className="text-xl font-semibold tracking-tight">{getPublicMediaDisplayTitle(item)}</h2>
              <p className="text-sm text-muted-foreground">Uploaded {formatDate(item.createdAt)}</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close viewer">
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Caption</p>
              <p className="text-muted-foreground">{item.caption || "No caption provided."}</p>
            </div>

            <div>
              <p className="font-medium">Linked Tour</p>
              {item.Tour ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{item.Tour.title}</span>
                  <Link href={`/shared/${workspaceSlug}/Tours/${item.Tour.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View Tour
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground">This content is private or not shared with you.</p>
              )}
            </div>

            <div>
              <p className="font-medium">Linked Gig</p>
              <p className="text-muted-foreground">{item.Gig?.title || "This content is private or not shared with you."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
