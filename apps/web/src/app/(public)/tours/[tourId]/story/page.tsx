import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDistanceKm } from "@gigeze/shared";
import { JourneyReplayMap } from "@/components/tours/tour-replay-map";
import { JourneyFollowToggle } from "@/components/tours/tour-follow-toggle";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { SectionReveal } from "@/components/layout/section-reveal";
import { MapBoundary } from "@/components/maps/map-boundary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicMomentCards } from "@/components/external-media/public-moment-cards";
import { mapJourneyToMapData } from "@/features/maps/service";
import { getPublicJourneyByIdOrSlug } from "@/features/tours/service";
import { calculateJourneyHighlights, groupStopsByDay, selectHeroMediaMoment } from "@/features/tours/storytelling";
import { listPublicExternalMediaLinksForJourney } from "@/features/external-media/service";
import { formatPublicAttribution } from "@/lib/public-attribution";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}): Promise<Metadata> {
  const { journeyId } = await params;
  const Tour = await getPublicJourneyByIdOrSlug(journeyId);

  if (!Tour) {
    return {
      title: "Tour story not found | GigEze",
    };
  }

  const timelineStops = [...Tour.Gigs].sort((a, b) => getStopMoment(a).getTime() - getStopMoment(b).getTime());
  const heroMoment = selectHeroMediaMoment({
    Gigs: timelineStops,
    mediaItems: Tour.mediaItems,
  });
  const description = Tour.description || `Follow ${Tour.title} by ${formatPublicAttribution(Tour)} through ${timelineStops.length} shared Gigs.`;

  return {
    title: `${Tour.title} story | GigEze`,
    description,
    openGraph: {
      title: `${Tour.title} story`,
      description,
      images: [
        {
          url: heroMoment?.mediaUrl || Tour.coverImageUrl || "/og-image.svg",
          width: 1200,
          height: 630,
          alt: heroMoment?.caption || `${Tour.title} story`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${Tour.title} story`,
      description,
      images: [heroMoment?.mediaUrl || Tour.coverImageUrl || "/og-image.svg"],
    },
  };
}

function formatDate(value?: Date | null) {
  if (!value) {
    return "Date unknown";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

function getStopMoment(Gig: {
  arrivalDate?: Date | null;
  departureDate?: Date | null;
  createdAt: Date;
}) {
  return Gig.arrivalDate ?? Gig.departureDate ?? Gig.createdAt;
}

export default async function PublicJourneyStoryPage({
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
  const timelineStops = [...Tour.Gigs].sort((a, b) => getStopMoment(a).getTime() - getStopMoment(b).getTime());
  const dayGroups = groupStopsByDay(timelineStops);
  const highlights = calculateJourneyHighlights({
    Gigs: timelineStops,
    mediaItems: Tour.mediaItems,
  });
  const heroMoment = selectHeroMediaMoment({
    Gigs: timelineStops,
    mediaItems: Tour.mediaItems,
  });
  const mediaByStopId = new Map<string, (typeof Tour.mediaItems)[number]>(
    (Tour.mediaItems ?? [])
      .filter((item) => item.stopId)
      .map((item) => [item.stopId as string, item]),
  );
  const stopTitleById = new Map(timelineStops.map((Gig) => [Gig.id, Gig.title]));
  const journeyExternalMomentLinks = publicExternalMomentLinks.filter((link) => link.entityType === "Tour");
  const stopExternalMomentLinks = publicExternalMomentLinks.filter((link) => link.entityType === "MOMENT");

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Story mode</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{Tour.title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{Tour.description || "A shareable memory timeline of this public Tour."}</p>
        <PublicAttribution source={Tour} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/Tours/${Tour.slug}`} className="text-sm font-medium text-primary hover:underline">
            Back to public Tour
          </Link>
          <Link href={`/gallery?Tour=${Tour.id}`} className="text-sm font-medium text-primary hover:underline">
            Tour gallery
          </Link>
          <Link href="/posts" className="text-sm font-medium text-primary hover:underline">
            More road stories
          </Link>
          <JourneyFollowToggle journeyKey={`public-story:${Tour.id}`} journeyTitle={Tour.title} />
        </div>
      </div>

      {heroMoment ? (
        <SectionReveal>
          <Card className="overflow-hidden">
            <div className="relative h-60 w-full sm:h-80">
              <Image
                src={heroMoment.mediaUrl}
                alt={heroMoment.caption}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
              <div
                className="absolute inset-0"
                style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.2), rgba(0,0,0,0))" }}
                aria-hidden
              />
              <div className="absolute bottom-0 w-full p-4 text-white sm:p-6">
                <p className="text-xs uppercase tracking-wide text-white/80">Hero memory</p>
                <p className="mt-1 text-xl font-semibold sm:text-2xl">{heroMoment.caption}</p>
                {heroMoment.stopTitle ? <p className="mt-1 text-sm text-white/85">Captured around {heroMoment.stopTitle}</p> : null}
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
          emptyTitle="No story route yet"
          emptyDescription="No public Gigs are available for route replay yet."
        />
      </SectionReveal>

      <SectionReveal delayMs={120}>
        <Card>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Longest drive</p>
              <p className="mt-1 font-medium text-foreground">{highlights.longestDrive ? formatDistanceKm(highlights.longestDrive.distanceKm) : "No public drive logs"}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most captured Gig</p>
              <p className="mt-1 font-medium text-foreground">{highlights.stopWithMostMedia ? highlights.stopWithMostMedia.stopTitle : "No moment-rich Gig yet"}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Busiest day</p>
              <p className="mt-1 font-medium text-foreground">{highlights.busiestDay ? `${highlights.busiestDay.dateLabel} (${highlights.busiestDay.activityCount} moments)` : "No day summary yet"}</p>
            </div>
          </CardContent>
        </Card>
      </SectionReveal>

      <SectionReveal delayMs={140}>
        <PublicMomentCards title="Tour moments" links={journeyExternalMomentLinks} />
      </SectionReveal>

      {dayGroups.length ? (
        <div className="space-y-6">
          {dayGroups.map((group, groupIndex) => (
            <SectionReveal key={group.dateKey} delayMs={150 + groupIndex * 40}>
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{group.dayLabel}</Badge>
                  <p className="text-sm text-muted-foreground">{group.dateLabel}</p>
                </div>

                <div className="space-y-4">
                  {group.Gigs.map((Gig, stopIndex) => {
                    const media = mediaByStopId.get(Gig.id);

                    return (
                      <Card key={Gig.id} className="transition-shadow duration-200 hover:shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg">{stopIndex + 1}. {Gig.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <p className="text-muted-foreground">{formatDate(getStopMoment(Gig))}</p>
                          <p className="text-muted-foreground">{Gig.locationName || "Location not specified"}</p>

                          {Gig.description ? (
                            <p>{Gig.description}</p>
                          ) : (
                            <p className="text-muted-foreground">No Gig notes were added for this moment.</p>
                          )}

                          {media?.publicUrl ? (
                            <div className="space-y-2">
                              <Image
                                src={media.publicUrl}
                                alt={media.caption || `${Gig.title} moment`}
                                width={960}
                                height={540}
                                className="h-56 w-full rounded-lg border object-cover"
                              />
                              {media.caption ? <p className="text-muted-foreground">{media.caption}</p> : null}
                            </div>
                          ) : null}

                          <PublicMomentCards
                            title="Gig moments"
                            links={stopExternalMomentLinks.filter((link) => link.entityId === Gig.id)}
                            stopTitleById={stopTitleById}
                            framed={false}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            </SectionReveal>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No story moments yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No public Gigs are available for this story yet.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
