import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/branding/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { MapBoundary } from "@/components/maps/map-boundary";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireAuthenticatedUser } from "@/lib/auth/workspace";
import { getJourneyByIdOrSlug } from "@/features/tours/service";
import { mapJourneyToMapData } from "@/features/maps/service";
import { getWorkspaceForMemberBySlug } from "@/features/workspaces/service";
import { calculateJourneyInsights, formatJourneySummary, sortStopsChronologically } from "@/features/tours/insights";

const RESTRICTED_MESSAGE = "This content is private or not shared with you";

function formatDateTime(value?: Date | null) {
  if (!value) {
    return "Date unknown";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function SharedJourneyDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; journeySlug: string }>;
}) {
  const { workspaceSlug, journeySlug } = await params;
  const user = await requireAuthenticatedUser();
  const memberWorkspace = await getWorkspaceForMemberBySlug(workspaceSlug, user.id);

  if (!memberWorkspace) {
    notFound();
  }

  const Tour = await getJourneyByIdOrSlug(memberWorkspace.workspace.id, journeySlug, ["SHARED", "PUBLIC"]);

  if (!Tour) {
    return (
      <section className="space-y-6">
        <Link href={`/shared/${workspaceSlug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to workspace
        </Link>
        <EmptyState title="Tour unavailable" description={RESTRICTED_MESSAGE} />
      </section>
    );
  }

  const mapData = mapJourneyToMapData(Tour, { journeyHrefBase: `/shared/${workspaceSlug}/tours` });
  const timelineStops = sortStopsChronologically(Tour.Gigs);
  const insights = calculateJourneyInsights(timelineStops);
  const mediaPreviewByStopId = new Map(
    Tour.mediaItems
      .filter((item) => item.stopId && item.publicUrl)
      .map((item) => [item.stopId as string, item.publicUrl as string]),
  );

  return (
    <section className="space-y-6">
      <Link href={`/shared/${workspaceSlug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Back to workspace
      </Link>

      <header className="space-y-3 rounded-3xl border border-border/80 bg-card/90 p-6 sm:p-8">
        <Link href="/" className="inline-flex items-center rounded-lg transition-opacity hover:opacity-88 focus-visible:ring-2 focus-visible:ring-ring/65">
          <Logo variant="full" size="sm" className="brand-mark-muted" aria-label="GigEze home" />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Viewer Mode</Badge>
          <VisibilityBadge visibility={Tour.visibility} />
          <Badge variant="secondary">{Tour.status.toLowerCase()}</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{Tour.title}</h1>
        <p className="max-w-prose text-base leading-7 text-muted-foreground">{Tour.description || "No description for this Tour yet."}</p>
        <p className="text-sm text-muted-foreground">{formatJourneySummary(insights)}</p>
      </header>

      <MapBoundary
        data={[mapData]}
        mode="private"
        showRouteLines
        emptyTitle="No visible Gigs to map"
        emptyDescription={RESTRICTED_MESSAGE}
      />

      <Card>
        <CardHeader>
          <CardTitle>Tour timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineStops.length ? (
            <ul className="space-y-4 sm:space-y-5">
              {timelineStops.map((Gig) => {
                const mediaPreview = mediaPreviewByStopId.get(Gig.id);

                return (
                <li key={Gig.id} className="relative rounded-2xl border border-border/85 bg-muted/15 p-3.5 pl-7 text-sm sm:p-4 sm:pl-8">
                  <div className="absolute top-0 bottom-0 left-2.5 w-px bg-border/70 sm:left-3" aria-hidden />
                  <div className="absolute top-5 left-2 h-3 w-3 rounded-full border border-primary/35 bg-primary/90 sm:top-6 sm:left-2.25" aria-hidden />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{Gig.title}</p>
                    <VisibilityBadge visibility={Gig.visibility} />
                  </div>
                  <p className="text-muted-foreground">{formatDateTime(Gig.arrivalDate || Gig.departureDate)}</p>
                  <p className="text-muted-foreground">{Gig.locationName || "Unknown location"}</p>
                  {Gig.description ? <p className="mt-1 text-muted-foreground">{Gig.description}</p> : null}
                  {mediaPreview ? (
                    <div
                      role="img"
                      aria-label={`${Gig.title} media preview`}
                      className="mt-2 h-16 w-16 rounded-lg border border-border/70 bg-cover bg-center sm:h-18 sm:w-18"
                      style={{ backgroundImage: `url(${mediaPreview})` }}
                    />
                  ) : null}
                </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No shared Gigs available" description={RESTRICTED_MESSAGE} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
