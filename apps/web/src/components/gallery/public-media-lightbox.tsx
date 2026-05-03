"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicMediaPreview } from "@/components/gallery/public-media-card";
import type { PublicGalleryMediaItem } from "@/features/media/service";
import { getPublicMediaDisplayTitle } from "@/features/media/public-url";

type PublicMediaLightboxProps = {
  item: PublicGalleryMediaItem | null;
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

export function PublicMediaLightbox({ item, onClose }: PublicMediaLightboxProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241D1B]/62 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button aria-label="Close gallery viewer" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-10 grid max-h-[90vh] w-full max-w-5xl gap-4 overflow-hidden rounded-[2rem] border border-border/70 bg-card/98 shadow-[0_24px_60px_rgba(36,48,40,0.18)] lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="relative flex min-h-72 items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(239,231,219,0.34))]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%)]" />
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

        <div className="flex flex-col gap-5 border-t border-border/70 p-6 lg:border-t-0 lg:border-l lg:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline">Public media</Badge>
              <h2 className="text-[1.35rem] font-semibold tracking-tight">{getPublicMediaDisplayTitle(item)}</h2>
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
              <p className="font-medium">Tour</p>
              {item.Tour ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{item.Tour.title}</span>
                  <Link href={`/tours/${item.Tour.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View Tour
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground">No public Tour linked.</p>
              )}
            </div>

            <div>
              <p className="font-medium">Gig</p>
              <p className="text-muted-foreground">{item.Gig?.title || "No public Gig linked."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
