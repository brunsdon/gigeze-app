"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { PublicMediaCard } from "@/components/gallery/public-media-card";
import type { PublicGalleryMediaItem } from "@/features/media/service";
import { PublicMediaLightbox } from "@/components/gallery/public-media-lightbox";
import { formatAppDateKey, formatInAppTimeZone } from "@/lib/datetime";

type PublicMediaGridProps = {
  items: PublicGalleryMediaItem[];
};

type GroupedMediaSection = {
  key: string;
  title: string;
  items: PublicGalleryMediaItem[];
};

function formatSectionDate(value: Date) {
  return formatInAppTimeZone(value, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildMediaSections(items: PublicGalleryMediaItem[]): GroupedMediaSection[] {
  const groups = new Map<string, GroupedMediaSection>();

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

export function PublicMediaGrid({ items }: PublicMediaGridProps) {
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
            <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {section.items.map((item) => {
                return (
                  <PublicMediaCard
                    key={item.id}
                    onSelect={() => setSelectedId(item.id)}
                    item={item}
                    cardClassName="group h-full overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    previewClassName="transition-transform duration-250 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    contentClassName="space-y-1.5 pt-3.5 sm:space-y-2 sm:pt-4"
                  >
                    <PublicAttribution source={item} className="line-clamp-1" />
                    {item.Tour ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        Tour:{" "}
                        <Link href={`/tours/${item.Tour.slug}`} className="font-medium text-foreground hover:underline">
                          {item.Tour.title}
                        </Link>
                      </p>
                    ) : null}
                    {item.Tour ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        <Link href={`/posts?Tour=${item.Tour.slug}`} className="font-medium text-primary hover:underline">
                          Stories from this Tour
                        </Link>
                      </p>
                    ) : null}
                    {item.Gig ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">Gig: {item.Gig.title}</p>
                    ) : null}
                  </PublicMediaCard>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <PublicMediaLightbox item={selectedItem} onClose={() => setSelectedId(null)} />
    </>
  );
}
