import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceKm } from "@gigeze/shared";
import { MapBoundary } from "@/components/maps/map-boundary";
import { JourneyReplayMap } from "@/components/tours/tour-replay-map";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { SectionReveal } from "@/components/layout/section-reveal";
import { getPublicJourneyByIdOrSlug } from "@/features/tours/service";
import { mapJourneyToMapData } from "@/features/maps/service";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PublicMomentCards } from "@/components/external-media/public-moment-cards";
import { listPublicExternalMediaLinksForJourney } from "@/features/external-media/service";
import { calculateJourneyInsights, formatJourneySummary, sortStopsChronologically } from "@/features/tours/insights";
import { calculateJourneyHighlights, groupStopsByDay, selectHeroMediaMoment } from "@/features/tours/storytelling";
import { resolvePublicMediaUrlBySize } from "@/features/media/public-url";
import { formatInAppTimeZone } from "@/lib/datetime";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function formatDateTime(value?: Date | null) {
  if (!value) {
    return "Date unknown";
  }

  return formatInAppTimeZone(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PublicJourneyDetailPage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;
  const Tour = await getPublicJourneyByIdOrSlug(journeyId);

  if (!Tour) {
    notFound();
  }

  const publicExternalMomentLinks = await listPublicExternalMediaLinksForJourney(
    Tour.workspaceId,
    Tour.id,
    Tour.Gigs.map((Gig) => Gig.id),
  );
  const mapData = mapJourneyToMapData(Tour, { includePublicJourneyHref: true });
  const timelineStops = sortStopsChronologically(Tour.Gigs);
  const dayGroups = groupStopsByDay(timelineStops);
  const insights = calculateJourneyInsights(timelineStops);
  const highlights = calculateJourneyHighlights({
    Gigs: timelineStops,
    mediaItems: Tour.mediaItems,
  });
  const heroMoment = selectHeroMediaMoment({
    Gigs: timelineStops,
    mediaItems: Tour.mediaItems,
  });
  const supabaseUrl = getSupabasePublicEnv().url;
  const journeyMediaItems = Tour.mediaItems ?? [];
  const stopTitleById = new Map(timelineStops.map((Gig) => [Gig.id, Gig.title]));
  const journeyExternalMomentLinks = publicExternalMomentLinks.filter((link) => link.entityType === "Tour");
  const stopExternalMomentLinks = publicExternalMomentLinks.filter((link) => link.entityType === "MOMENT");
  const mediaPreviewByStopId = new Map(
    journeyMediaItems
      .filter((item) => item.stopId && item.publicUrl)
      .map((item) => [
        item.stopId as string,
        resolvePublicMediaUrlBySize(
          { publicUrl: item.publicUrl, fileName: item.fileName ?? "", mimeType: item.mimeType ?? "image/jpeg" },
          "thumb",
          { supabaseUrl },
        ) ?? (item.publicUrl as string),
      ]),
  );

  return (
    <section className="public-page-shell">
      <div>
        <h1 className="public-page-title">{Tour.title}</h1>
        <p className="mt-3 public-page-intro">{Tour.description || "No description for this Tour yet."}</p>
        <p className="mt-1 public-page-meta">Published from GigEze tour records.</p>
        <PublicAttribution source={Tour} className="mt-2" />
        <p className="mt-2 public-page-meta">{formatJourneySummary(insights)}</p>
        <div className="mt-3 public-page-link-row">
          <Link href={`/tours/${Tour.slug}/story`} className="public-inline-cta">
            Open shareable story view
          </Link>
          <CopyButton text={`/tours/${Tour.slug}/story`} label="Share this Tour" />
          <Link href={`/gallery?Tour=${Tour.id}`} className="public-inline-cta">
            Browse Tour moments
          </Link>
          <Link href="/posts" className="public-inline-cta">
            Read related public posts
          </Link>
          <Link href="/login?mode=signup" className="public-inline-cta">
            Start tracking your own Tour -&gt;
          </Link>
        </div>
      </div>

      {heroMoment ? (
        <SectionReveal>
          <Card className="overflow-hidden">
            <div className="relative h-56 w-full sm:h-72">
              <Image
                src={resolvePublicMediaUrlBySize(
                  { publicUrl: heroMoment.mediaUrl, fileName: "", mimeType: "image/jpeg" },
                  "medium",
                  { supabaseUrl },
                ) ?? heroMoment.mediaUrl}
                alt={heroMoment.caption}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
              <div
                className="absolute inset-0"
                style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.1), rgba(0,0,0,0))" }}
                aria-hidden
              />
              <div className="absolute bottom-0 w-full p-4 text-white sm:p-5">
                <p className="text-xs uppercase tracking-wide text-white/80">Tour memory</p>
                <p className="mt-1 text-lg font-semibold leading-tight sm:text-xl">{heroMoment.caption}</p>
                {heroMoment.stopTitle ? <p className="mt-1 text-sm text-white/85">Near {heroMoment.stopTitle}</p> : null}
              </div>
            </div>
          </Card>
        </SectionReveal>
      ) : null}

      <SectionReveal delayMs={40}>
        <JourneyReplayMap mapData={mapData} />
      </SectionReveal>

      <SectionReveal delayMs={80}>
        <MapBoundary
          data={[mapData]}
          mode="public"
          showRouteLines
          animateOnLoad
          emptyTitle="No public Gigs to map"
          emptyDescription="This Tour is public, but no public Gigs are currently available."
        />
      </SectionReveal>

      <SectionReveal delayMs={120}>
        <Card>
          <CardHeader>
            <CardTitle>Tour highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-border/75 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Longest drive</p>
              <p className="mt-1 font-medium text-foreground">
                {highlights.longestDrive ? formatDistanceKm(highlights.longestDrive.distanceKm) : "No public drive logs"}
              </p>
            </div>
            <div className="rounded-xl border border-border/75 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most captured Gig</p>
              <p className="mt-1 font-medium text-foreground">
                {highlights.stopWithMostMedia ? highlights.stopWithMostMedia.stopTitle : "No moment-rich Gig yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border/75 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Busiest day</p>
              <p className="mt-1 font-medium text-foreground">
                {highlights.busiestDay ? `${highlights.busiestDay.dateLabel} (${highlights.busiestDay.activityCount} moments)` : "No day summary yet"}
              </p>
            </div>
          </CardContent>
        </Card>
      </SectionReveal>

      <SectionReveal delayMs={150}>
        <PublicMomentCards title="Tour moments" links={journeyExternalMomentLinks} />
      </SectionReveal>

      <SectionReveal delayMs={165}>
        <PublicMomentCards title="Gig moments" links={stopExternalMomentLinks} stopTitleById={stopTitleById} />
      </SectionReveal>

      <SectionReveal delayMs={180}>
        <Card>
          <CardHeader>
            <CardTitle>Related from this Tour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Related images: <span className="font-medium text-foreground">{journeyMediaItems.length}</span>
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={`/gallery?Tour=${Tour.id}`} className="font-medium text-primary hover:underline">
                View Tour images
              </Link>
              <Link href={`/posts?Tour=${Tour.slug}`} className="font-medium text-primary hover:underline">
                Read Tour stories
              </Link>
              <Link href="/login" className="font-medium text-primary hover:underline">
                Build tour records
              </Link>
            </div>
          </CardContent>
        </Card>
      </SectionReveal>

      <SectionReveal delayMs={210}>
      <Card>
        <CardHeader>
          <CardTitle>Tour timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {dayGroups.length ? (
            <div className="space-y-6">
              {dayGroups.map((group) => (
                <section key={group.dateKey} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{group.dayLabel}</Badge>
                    <p className="text-sm text-muted-foreground">{group.dateLabel}</p>
                  </div>
                  <ul className="space-y-4 sm:space-y-5">
              {group.Gigs.map((Gig) => {
                const mediaPreview = mediaPreviewByStopId.get(Gig.id);

                return (
                <li key={Gig.id} className="relative rounded-2xl border border-border/85 bg-muted/18 p-3.5 pl-7 sm:p-4 sm:pl-8">
                  <div className="absolute top-0 bottom-0 left-2.5 w-px bg-border/70 sm:left-3" aria-hidden />
                  <div className="absolute top-5 left-2 h-3 w-3 rounded-full border border-primary/35 bg-primary/90 sm:top-6 sm:left-2.25" aria-hidden />
                  <p className="font-medium">{Gig.title}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(Gig.arrivalDate || Gig.departureDate)}</p>
                  <p className="text-sm text-muted-foreground">{Gig.locationName || "Unknown location"}</p>
                  {Gig.description ? <p className="mt-1 text-sm text-muted-foreground">{Gig.description}</p> : null}
                  {mediaPreview ? (
                    <div
                      role="img"
                      aria-label={`${Gig.title} moment preview`}
                      className="mt-2 h-16 w-16 rounded-lg border border-border/70 bg-cover bg-center sm:h-18 sm:w-18"
                      style={{ backgroundImage: `url(${mediaPreview})` }}
                    />
                  ) : null}
                </li>
                );
              })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="No Gigs yet" description="No Gigs have been shared for this Tour yet. Check back soon for the next leg." />
          )}
        </CardContent>
      </Card>
      </SectionReveal>
    </section>
  );
}
