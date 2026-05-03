import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDistanceKm } from "@gigeze/shared";
import { SectionReveal } from "@/components/layout/section-reveal";
import { JourneyReplayMap } from "@/components/tours/tour-replay-map";
import { MapBoundary } from "@/components/maps/map-boundary";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { getJourneyByIdOrSlug } from "@/features/tours/service";
import { mapJourneyToMapData } from "@/features/maps/service";
import { calculateJourneyHighlights, groupStopsByDay, selectHeroMediaMoment } from "@/features/tours/storytelling";

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

export default async function JourneyStoryModePage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;
  const workspace = await requireCurrentWorkspace();
  const Tour = await getJourneyByIdOrSlug(workspace.id, journeyId);

  if (!Tour) {
    notFound();
  }

  const mapData = mapJourneyToMapData(Tour);
  const timelineStops = [...Tour.Gigs].sort((a, b) => getStopMoment(a).getTime() - getStopMoment(b).getTime());
  const dayGroups = groupStopsByDay(timelineStops);
  const highlights = calculateJourneyHighlights({
    Gigs: timelineStops,
    mediaItems: Tour.mediaItems,
    drivingLogs: Tour.drivingLogs,
    activityNotes: Tour.activityNotes,
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
  const publicStoryHref = Tour.visibility === "PUBLIC" ? `/tours/${Tour.slug}/story` : null;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{Tour.title} story</h1>
          <p className="text-muted-foreground">A narrative replay you can relive and share.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicStoryHref ? (
            <Link href={publicStoryHref} className={buttonVariants({ variant: "outline" })}>
              Open public story URL
            </Link>
          ) : null}
          <Link href={`/dashboard/tours/${Tour.id}`} className={buttonVariants({ variant: "outline" })}>
            Back to Tour
          </Link>
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
          mode="private"
          showRouteLines
          animateOnLoad
          emptyTitle="No story route yet"
          emptyDescription="Add Gigs to see your Tour route on the map."
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
              <p className="mt-1 font-medium text-foreground">{highlights.longestDrive ? formatDistanceKm(highlights.longestDrive.distanceKm) : "No drive logs yet"}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most captured Gig</p>
              <p className="mt-1 font-medium text-foreground">{highlights.stopWithMostMedia ? highlights.stopWithMostMedia.stopTitle : "No moment-rich Gig yet"}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Busiest day</p>
              <p className="mt-1 font-medium text-foreground">{highlights.busiestDay ? highlights.busiestDay.dateLabel : "No activity day yet"}</p>
            </div>
          </CardContent>
        </Card>
      </SectionReveal>

      {!dayGroups.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No story moments yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add Gigs, notes, or moments to generate a richer Tour story.
          </CardContent>
        </Card>
      ) : (
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
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            </SectionReveal>
          ))}
        </div>
      )}
    </section>
  );
}
