"use client";

import { useMemo, useState } from "react";
import { PublicMediaCard } from "@/components/gallery/public-media-card";
import { SharedMediaLightbox, type SharedGalleryMediaItem } from "@/components/gallery/shared-media-lightbox";
import { formatAppDateKey } from "@/lib/datetime";

export type { SharedGalleryMediaItem };

type SharedMediaGridProps = {
  workspaceSlug: string;
  items: SharedGalleryMediaItem[];
};

type GroupedSharedMediaSection = {
  key: string;
  title: string;
  items: SharedGalleryMediaItem[];
};

function formatSectionDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

function buildMediaSections(items: SharedGalleryMediaItem[]): GroupedSharedMediaSection[] {
  const groups = new Map<string, GroupedSharedMediaSection>();

  items.forEach((item) => {
    const stopTitle = item.Gig?.title?.trim();
    const key = stopTitle ? `Gig:${stopTitle}` : `date:${formatAppDateKey(item.createdAt)}`;
    const title = stopTitle ? `Gig: ${stopTitle}` : formatSectionDate(item.createdAt);

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      return;
    }

    groups.set(key, {
      key,
      title,
      items: [item],
    });
  });

  return Array.from(groups.values());
}

export function SharedMediaGrid({ workspaceSlug, items }: SharedMediaGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mediaSections = useMemo(() => buildMediaSections(items), [items]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  return (
    <>
      <div className="space-y-4 sm:space-y-5">
        {mediaSections.map((section) => (
          <section key={section.key} className="space-y-2 sm:space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">{section.title}</h2>
            <div className="grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {section.items.map((item) => {
                return (
                  <PublicMediaCard
                    key={item.id}
                    onSelect={() => setSelectedId(item.id)}
                    item={item}
                    cardClassName="h-full overflow-hidden transition-shadow duration-200 hover:shadow-sm"
                    contentClassName="space-y-1.5 pt-3.5 sm:space-y-2 sm:pt-5"
                  >
                    {item.Tour ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">Tour: {item.Tour.title}</p>
                    ) : (
                      <p className="line-clamp-1 text-xs text-muted-foreground">Tour: This content is private or not shared with you.</p>
                    )}
                  </PublicMediaCard>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <SharedMediaLightbox item={selectedItem} workspaceSlug={workspaceSlug} onClose={() => setSelectedId(null)} />
    </>
  );
}
