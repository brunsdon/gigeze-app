import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDistanceKm } from "@gigeze/shared";
import { ExternalMediaEntityType } from "@prisma/client";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ExternalMediaSection } from "@/components/external-media/external-media-section";
import { StopCoordinateInputs } from "@/components/forms/gig-coordinate-inputs";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionReveal } from "@/components/layout/section-reveal";
import { TripSessionPanel } from "@/components/layout/trip-session-panel";
import { JourneyReplayMap } from "@/components/tours/tour-replay-map";
import { MapBoundary } from "@/components/maps/map-boundary";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createStopAction,
  deleteStopAction,
  duplicateStopAction,
  moveStopDownAction,
  moveStopUpAction,
} from "@/features/gigs/actions";
import { formatActivityDuration, getActivityTypeLabel, listActivityNotesForJourney } from "@/features/activity-notes/service";
import { mapJourneyToMapData } from "@/features/maps/service";
import {
  deleteJourneyAction,
  duplicateJourneyAction,
  setJourneyActiveStateAction,
} from "@/features/tours/actions";
import { listExternalMediaLinksForJourneyMoments } from "@/features/external-media/service";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { visibilityOptions } from "@/lib/visibility";
import { getJourneyByIdOrSlug } from "@/features/tours/service";
import { getDefaultVehicle } from "@/features/vehicles/service";
import { calculateJourneyInsights, formatJourneySummary } from "@/features/tours/insights";
import { calculateJourneyHighlights, groupStopsByDay, selectHeroMediaMoment } from "@/features/tours/storytelling";
import { formatInAppTimeZone } from "@/lib/datetime";
import { getCompletedStopsCount, getJourneyProgressPercent } from "@/lib/tours/progress";

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return formatInAppTimeZone(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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

function getExcerpt(value?: string | null, maxLength = 140) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}...` : value;
}

export default async function DashboardJourneyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ journeyId: string }>;
  searchParams: Promise<{ focusStopId?: string; lat?: string; lng?: string }>;
}) {
  const { journeyId } = await params;
  const { focusStopId, lat, lng } = await searchParams;
  const workspace = await requireCurrentWorkspace();
  const [Tour, defaultVehicle] = await Promise.all([
    getJourneyByIdOrSlug(workspace.id, journeyId),
    getDefaultVehicle(workspace.id),
  ]);

  if (!Tour) {
    notFound();
  }

  const journeyMapData = mapJourneyToMapData(Tour);
  const timelineStops = [...Tour.Gigs].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const [externalMediaLinks, activityEntries] = await Promise.all([
    listExternalMediaLinksForJourneyMoments(
      workspace.id,
      Tour.id,
      timelineStops.map((Gig) => Gig.id),
    ).catch(() => []),
    listActivityNotesForJourney(workspace.id, Tour.id).catch(() => []),
  ]);
  const insights = calculateJourneyInsights(timelineStops);
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
  const completedStops = getCompletedStopsCount(timelineStops);
  const progressPercent = getJourneyProgressPercent(timelineStops);
  const firstStop = timelineStops[0];
  const latestStop = timelineStops[timelineStops.length - 1];
  const startedDaysAgo = Math.max(
    0,
    Math.floor((new Date().getTime() - Tour.startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const prefilledLatitude = lat && Number.isFinite(Number(lat)) ? Number(lat).toFixed(6) : "";
  const prefilledLongitude = lng && Number.isFinite(Number(lng)) ? Number(lng).toFixed(6) : "";
  const driveStartLocation = latestStop?.locationName ?? latestStop?.title ?? "";
  const latestJourneyDrivingLog = Tour.drivingLogs[0];
  const startOdometerQuery = typeof latestJourneyDrivingLog?.endOdometer === "number"
    ? `&startOdometer=${latestJourneyDrivingLog.endOdometer}`
    : "";
  const driveLogHref = `/dashboard/logs/driving?journeyId=${Tour.id}&startLocation=${encodeURIComponent(driveStartLocation)}${startOdometerQuery}`;
  const momentTargetOptions = [
    {
      entityType: ExternalMediaEntityType.Tour,
      entityId: Tour.id,
      label: "Whole Tour",
    },
    ...timelineStops.map((Gig) => ({
      entityType: ExternalMediaEntityType.MOMENT,
      entityId: Gig.id,
      label: `Gig: ${Gig.title}`,
    })),
  ];
  const momentTargetLabelByValue = Object.fromEntries(
    momentTargetOptions.map((option) => [`${option.entityType}:${option.entityId}`, option.label]),
  );
  const hostedMomentCountByStopId = new Map<string, number>();
  for (const link of externalMediaLinks) {
    if (link.entityType !== ExternalMediaEntityType.MOMENT) {
      continue;
    }

    hostedMomentCountByStopId.set(link.entityId, (hostedMomentCountByStopId.get(link.entityId) ?? 0) + 1);
  }
  const activityCountByStopId = new Map<string, number>();
  for (const note of activityEntries) {
    if (!note.stopId) {
      continue;
    }

    activityCountByStopId.set(note.stopId, (activityCountByStopId.get(note.stopId) ?? 0) + 1);
  }
  const recentActivityEntries = activityEntries.slice(0, 5);

  const mediaPreviewByStopId = new Map(
    (Tour.mediaItems ?? [])
      .filter((item) => item.stopId && item.publicUrl)
      .map((item) => [item.stopId as string, item.publicUrl as string]),
  );
  const publicStoryPath = `/tours/${Tour.slug}/story`;
  const canShareJourney = Tour.visibility === "PUBLIC";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{Tour.title}</h1>
            {Tour.status === "ACTIVE" ? <Badge>Active</Badge> : null}
            <VisibilityBadge visibility={Tour.visibility} />
          </div>
          <p className="text-sm text-muted-foreground">Manage tour details, gigs, media, field notes, and public visibility.</p>
          <p className="text-sm text-muted-foreground">{formatJourneySummary(insights)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={setJourneyActiveStateAction}>
            <input type="hidden" name="journeyId" value={Tour.id} />
            <input type="hidden" name="makeActive" value={Tour.status === "ACTIVE" ? "false" : "true"} />
            <ActionSubmitButton
              label={Tour.status === "ACTIVE" ? "Clear active" : "Set active"}
              pendingLabel="Saving..."
              variant="outline"
            />
          </form>
          <form action={duplicateJourneyAction}>
            <input type="hidden" name="journeyId" value={Tour.id} />
            <ActionSubmitButton label="Duplicate" pendingLabel="Duplicating..." variant="outline" />
          </form>
          <Link
            href={`/dashboard/tours/${Tour.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit Tour
          </Link>
          <Link href={driveLogHref} className={buttonVariants({ variant: "outline" })}>
            Log drive from last Gig
          </Link>
          <Link href={`/dashboard/tours/${Tour.id}/story`} className={buttonVariants({ variant: "outline" })}>
            Story mode
          </Link>
          {canShareJourney ? (
            <CopyButton text={publicStoryPath} label="Share this Tour" />
          ) : (
            <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/25 px-2.5 py-1 text-xs text-muted-foreground">
              Set visibility to Public to share
            </span>
          )}
          <Link href="#add-Gig" className={buttonVariants()}>
            Add Gig
          </Link>
          <Link href="#Tour-moments" className={buttonVariants({ variant: "outline" })}>
            Add moment
          </Link>
          <Link href={`/dashboard/activity?journeyId=${Tour.id}`} className={buttonVariants({ variant: "outline" })}>
            Add activity
          </Link>
        </div>
      </div>

      {canShareJourney ? (
        <Card className="bg-card/96">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Share this Tour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">Copy your public story link and share the latest route highlights.</p>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={publicStoryPath} label="Copy public story URL" />
              <Link href={publicStoryPath} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Preview public story
              </Link>
            </div>
            <p className="truncate text-xs text-muted-foreground">{publicStoryPath}</p>
          </CardContent>
        </Card>
      ) : null}

      <TripSessionPanel
        workspaceId={workspace.id}
        Tours={[{ id: Tour.id, title: Tour.title, slug: Tour.slug }]}
        defaultJourneyId={Tour.id}
        defaultVehicleId={defaultVehicle?.id}
        showJourneyPicker={false}
        gpsSamplingIntervalSeconds={workspace.gpsSamplingIntervalSeconds}
      />

      <SectionReveal delayMs={20}>
        <ExternalMediaSection
          id="Tour-moments"
          entityType={ExternalMediaEntityType.Tour}
          entityId={Tour.id}
          links={externalMediaLinks}
          returnTo={`/dashboard/tours/${Tour.id}`}
          title="Tour moments"
            helperText="Add a Flickr photo or YouTube video to this tour."
          targetOptions={momentTargetOptions}
          defaultTargetValue={`${ExternalMediaEntityType.Tour}:${Tour.id}`}
          targetLabelByValue={momentTargetLabelByValue}
        />
      </SectionReveal>

      <SectionReveal delayMs={35}>
        <Card id="Tour-activity">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Keep work, maintenance, admin, and field notes with this tour.</p>
            </div>
            <Link href={`/dashboard/activity?journeyId=${Tour.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Add activity
            </Link>
          </CardHeader>
          <CardContent>
            {!recentActivityEntries.length ? (
              <EmptyState
                title="No backstage notes yet"
                description="Capture the first activity note when work, maintenance, admin, or show details need to stay with this tour."
                ctaLabel="Capture Activity"
                ctaHref={`/dashboard/activity?journeyId=${Tour.id}`}
              />
            ) : (
              <ul className="space-y-2 text-sm">
                {recentActivityEntries.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{getActivityTypeLabel(entry.type)}</Badge>
                      <span className="text-muted-foreground">{formatDate(entry.date)}</span>
                      {formatActivityDuration(entry.durationMinutes) ? (
                        <span className="text-muted-foreground">• {formatActivityDuration(entry.durationMinutes)}</span>
                      ) : null}
                      {entry.Gig?.title ? <span className="text-muted-foreground">• {entry.Gig.title}</span> : null}
                      {entry.location ? <span className="text-muted-foreground">• {entry.location}</span> : null}
                    </div>
                    {entry.notes ? <p className="mt-2 text-muted-foreground">{getExcerpt(entry.notes, 140)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </SectionReveal>

      {heroMoment ? (
        <SectionReveal>
          <Card className="overflow-hidden">
            <div className="relative h-56 w-full sm:h-72">
              <Image
                src={heroMoment.mediaUrl}
                alt={heroMoment.caption}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
              <div
                className="absolute inset-0"
                style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.2), rgba(0,0,0,0))" }}
                aria-hidden
              />
              <div className="absolute bottom-0 w-full p-4 text-white sm:p-5">
                <p className="text-xs uppercase tracking-wide text-white/80">Hero moment</p>
                <p className="mt-1 text-lg font-semibold leading-tight sm:text-xl">{heroMoment.caption}</p>
                {heroMoment.stopTitle ? <p className="mt-1 text-sm text-white/85">Captured near {heroMoment.stopTitle}</p> : null}
              </div>
            </div>
          </Card>
        </SectionReveal>
      ) : null}

      <SectionReveal delayMs={40}>
        <JourneyReplayMap mapData={journeyMapData} />
      </SectionReveal>

      <SectionReveal delayMs={80}>
        <MapBoundary
          data={[journeyMapData]}
          mode="private"
          focusMarkerId={focusStopId}
          showRouteLines
          animateOnLoad
          addStopBaseHref={`/dashboard/tours/${Tour.id}`}
          emptyTitle="No gigs loaded yet"
          emptyDescription="Add gigs to see venue markers and route rendering for this tour."
        />
      </SectionReveal>

      <SectionReveal delayMs={120}>
      <Card>
        <CardHeader>
          <CardTitle>Tour insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>You started this Tour {startedDaysAgo} {startedDaysAgo === 1 ? "day" : "days"} ago.</p>
          <p>You have visited {Tour.Gigs.length} {Tour.Gigs.length === 1 ? "place" : "places"} on this trip.</p>
          {firstStop ? <p>First Gig: <span className="font-medium text-foreground">{firstStop.title}</span>.</p> : null}
          {latestStop ? <p>Latest Gig: <span className="font-medium text-foreground">{latestStop.title}</span>.</p> : null}
        </CardContent>
      </Card>
      </SectionReveal>

      <SectionReveal delayMs={160}>
        <Card>
          <CardHeader>
            <CardTitle>Tour highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-border/75 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Longest drive</p>
              <p className="mt-1 font-medium text-foreground">
                {highlights.longestDrive ? formatDistanceKm(highlights.longestDrive.distanceKm) : "No trip logs yet"}
              </p>
              {highlights.longestDrive ? <p className="mt-1 text-muted-foreground">{highlights.longestDrive.dateLabel} · {highlights.longestDrive.routeLabel}</p> : null}
            </div>

            <div className="rounded-xl border border-border/75 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most captured Gig</p>
              <p className="mt-1 font-medium text-foreground">
                {highlights.stopWithMostMedia ? highlights.stopWithMostMedia.stopTitle : "No media-linked gigs yet"}
              </p>
              {highlights.stopWithMostMedia ? <p className="mt-1 text-muted-foreground">{highlights.stopWithMostMedia.mediaCount} captured moments</p> : null}
            </div>

            <div className="rounded-xl border border-border/75 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Busiest day</p>
              <p className="mt-1 font-medium text-foreground">
                {highlights.busiestDay ? highlights.busiestDay.dateLabel : "No dated activity yet"}
              </p>
              {highlights.busiestDay ? <p className="mt-1 text-muted-foreground">{highlights.busiestDay.activityCount} logged moments</p> : null}
            </div>
          </CardContent>
        </Card>
      </SectionReveal>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Tour summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground">Slug</p>
                <p className="font-medium">{Tour.slug}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{Tour.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Start date</p>
                <p className="font-medium">{formatDate(Tour.startDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">End date</p>
                <p className="font-medium">{formatDate(Tour.endDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gigs</p>
                <p className="font-medium">{Tour.Gigs.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Progress</p>
                <p className="font-medium">{completedStops}/{Tour.Gigs.length} ({progressPercent}%)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Visibility</p>
                <VisibilityBadge visibility={Tour.visibility} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Gig progress updates automatically as arrival/departure details are filled in.</p>
            </div>

            {Tour.description ? <p className="text-muted-foreground">{Tour.description}</p> : null}
            {Tour.coverImageUrl ? (
              <p className="truncate text-muted-foreground">Cover: {Tour.coverImageUrl}</p>
            ) : null}

            <form action={deleteJourneyAction} id={`delete-Tour-${Tour.id}`} className="mt-4 border-t pt-4">
              <input type="hidden" name="journeyId" value={Tour.id} />
              <ConfirmSubmitButton
                formId={`delete-Tour-${Tour.id}`}
                triggerLabel="Delete Tour"
                title="Delete Tour?"
                description="This permanently removes the Tour and its Gigs. Delete linked driving logs, activity notes, and uploaded moments first."
                confirmLabel="Delete Tour"
              />
            </form>
          </CardContent>
        </Card>

        <Card id="add-Gig" className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Add Gig</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createStopAction} className="space-y-4">
              <input type="hidden" name="journeyId" value={Tour.id} />
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationName">Location</Label>
                <Input id="locationName" name="locationName" defaultValue={prefilledLatitude ? "Pinned map location" : ""} />
              </div>
              <StopCoordinateInputs initialLatitude={prefilledLatitude} initialLongitude={prefilledLongitude} />
              <div className="space-y-2">
                <Label htmlFor="orderIndex">Order</Label>
                <Input id="orderIndex" name="orderIndex" type="number" defaultValue={Tour.Gigs.length + 1} min={1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <select id="visibility" name="visibility" defaultValue="PRIVATE" className="w-full">
                  {visibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <ActionSubmitButton label="Add Gig" pendingLabel="Adding..." />
            </form>
          </CardContent>
        </Card>
      </div>

      <SectionReveal delayMs={220}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Tour timeline</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/activity?journeyId=${Tour.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Add activity
            </Link>
            <Link href={`/dashboard/media?journeyId=${Tour.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Add moment
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {dayGroups.length ? (
            <div className="space-y-6">
              {dayGroups.map((group, groupIndex) => (
                <section key={group.dateKey} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{group.dayLabel}</Badge>
                    <p className="text-sm text-muted-foreground">{group.dateLabel}</p>
                  </div>
                  <ul className="space-y-4 sm:space-y-5">
              {group.Gigs.map((Gig, index) => {
                const mediaPreview = mediaPreviewByStopId.get(Gig.id);
                const stopMomentCount = (hostedMomentCountByStopId.get(Gig.id) ?? 0) + (mediaPreview ? 1 : 0);
                const hostedStopMomentCount = hostedMomentCountByStopId.get(Gig.id) ?? 0;
                const absoluteIndex = dayGroups
                  .slice(0, groupIndex)
                  .reduce((total, current) => total + current.Gigs.length, 0) + index;

                return (
                <li key={Gig.id} className="relative rounded-2xl border border-border/75 bg-card/70 p-3.5 pl-7 transition-colors hover:bg-muted/22 sm:p-4 sm:pl-8">
                  <div className="absolute top-0 bottom-0 left-2.5 w-px bg-border/70 sm:left-3" aria-hidden />
                  <div className="absolute top-5 left-2 h-3 w-3 rounded-full border border-primary/30 bg-primary/90 sm:top-6 sm:left-2.25" aria-hidden />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/tours/${Tour.id}?focusStopId=${Gig.id}#Tour-map`}
                          className="font-semibold decoration-border underline-offset-4 transition-colors hover:text-foreground hover:underline"
                        >
                          {Gig.title}
                        </Link>
                        <VisibilityBadge visibility={Gig.visibility} />
                        <Badge variant="outline">#{Gig.orderIndex}</Badge>
                        {stopMomentCount > 0 ? (
                          <Badge variant="secondary">
                            {stopMomentCount} {stopMomentCount === 1 ? "moment" : "moments"}
                          </Badge>
                        ) : null}
                        {(activityCountByStopId.get(Gig.id) ?? 0) > 0 ? (
                          <Badge variant="secondary">
                            {activityCountByStopId.get(Gig.id)} {(activityCountByStopId.get(Gig.id) ?? 0) === 1 ? "activity note" : "activity notes"}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-sm text-muted-foreground">{Gig.locationName || "Unknown location"}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(Gig.arrivalDate || Gig.departureDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Number(Gig.latitude).toFixed(5)}, {Number(Gig.longitude).toFixed(5)}
                      </p>
                      {Gig.description ? (
                        <p className="text-sm text-muted-foreground">{getExcerpt(Gig.description)}</p>
                      ) : null}

                      {mediaPreview ? (
                        <div
                          role="img"
                          aria-label={`${Gig.title} moment preview`}
                          className="mt-2 h-16 w-16 rounded-lg border border-border/70 bg-cover bg-center sm:h-18 sm:w-18"
                          style={{ backgroundImage: `url(${mediaPreview})` }}
                        />
                      ) : null}
                      {!mediaPreview && hostedStopMomentCount > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {hostedStopMomentCount} hosted {hostedStopMomentCount === 1 ? "moment" : "moments"} attached
                        </p>
                      ) : null}
                    </div>

                    <div className="grid w-full grid-cols-2 gap-1.5 min-[380px]:flex min-[380px]:w-auto min-[380px]:flex-wrap min-[380px]:items-center min-[380px]:gap-2">
                      <Link
                        href={`/dashboard/tours/${Tour.id}/gigs/${Gig.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "h-10 w-full justify-center sm:h-8 min-[380px]:w-auto" })}
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/media?journeyId=${Tour.id}&stopId=${Gig.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "h-10 w-full justify-center sm:h-8 min-[380px]:w-auto" })}
                      >
                        Add moment
                      </Link>
                      <Link
                        href={`/dashboard/activity?journeyId=${Tour.id}&stopId=${Gig.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "h-10 w-full justify-center sm:h-8 min-[380px]:w-auto" })}
                      >
                        Add activity
                      </Link>

                      <form action={moveStopUpAction}>
                        <input type="hidden" name="journeyId" value={Tour.id} />
                        <input type="hidden" name="stopId" value={Gig.id} />
                        <ActionSubmitButton
                          label="Move up"
                          size="sm"
                          variant="outline"
                          className="h-10 w-full justify-center sm:h-8 min-[380px]:w-auto"
                          disabled={absoluteIndex === 0}
                        />
                      </form>

                      <form action={moveStopDownAction}>
                        <input type="hidden" name="journeyId" value={Tour.id} />
                        <input type="hidden" name="stopId" value={Gig.id} />
                        <ActionSubmitButton
                          label="Move down"
                          size="sm"
                          variant="outline"
                          className="h-10 w-full justify-center sm:h-8 min-[380px]:w-auto"
                          disabled={absoluteIndex === timelineStops.length - 1}
                        />
                      </form>

                      <form action={duplicateStopAction}>
                        <input type="hidden" name="journeyId" value={Tour.id} />
                        <input type="hidden" name="stopId" value={Gig.id} />
                        <ActionSubmitButton
                          label="Duplicate"
                          pendingLabel="Duplicating..."
                          size="sm"
                          variant="outline"
                          className="h-10 w-full justify-center sm:h-8 min-[380px]:w-auto"
                        />
                      </form>

                      <form action={deleteStopAction} id={`delete-Gig-${Gig.id}`}>
                        <input type="hidden" name="stopId" value={Gig.id} />
                        <input type="hidden" name="journeyId" value={Tour.id} />
                        <ConfirmSubmitButton
                          formId={`delete-Gig-${Gig.id}`}
                          triggerLabel="Delete"
                          title="Delete Gig?"
                          description="This Gig will be permanently removed from the Tour."
                          confirmLabel="Delete Gig"
                          size="default"
                          className="h-10 w-full justify-center min-[380px]:w-auto"
                        />
                      </form>
                    </div>
                  </div>
                </li>
                );
              })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No gigs loaded yet"
              description="This tour is ready for its first gig. Add one to start mapping the run."
              ctaLabel="Add Gig"
              ctaHref="#add-Gig"
              secondaryCtaLabel="Add moment"
              secondaryCtaHref={`/dashboard/media?journeyId=${Tour.id}`}
            />
          )}
        </CardContent>
      </Card>
      </SectionReveal>
    </section>
  );
}
