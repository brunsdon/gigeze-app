"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceKm } from "@gigeze/shared";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTripTracker, type CompletedTripSummary } from "@/features/trips/use-trip-tracker";
import { useStopSuggestions } from "@/features/trips/use-Gig-suggestions";
import { TripLiveMap } from "@/components/maps/trip-live-map";
import { StopSuggestionCard } from "@/components/maps/Gig-suggestion-card";
import { formatInAppTimeZone } from "@/lib/datetime";

type TripJourneyOption = {
  id: string;
  title: string;
  slug: string;
};

type TripSessionPanelProps = {
  workspaceId: string;
  Tours: TripJourneyOption[];
  defaultJourneyId?: string;
  defaultVehicleId?: string;
  showJourneyPicker?: boolean;
  gpsSamplingIntervalSeconds?: number;
};

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatLastUpdate(value?: string) {
  if (!value) {
    return "Waiting for GPS";
  }

  return formatInAppTimeZone(new Date(value), {
    hour: "2-digit",
    minute: "2-digit",
  }, "Waiting for GPS");
}

function formatBackgroundDuration(durationMs: number | null) {
  if (durationMs === null) {
    return null;
  }

  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  if (totalMinutes < 1) {
    return "under a minute";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

export function TripSessionPanel({
  workspaceId,
  Tours,
  defaultJourneyId,
  defaultVehicleId,
  showJourneyPicker = true,
  gpsSamplingIntervalSeconds = 15,
}: TripSessionPanelProps) {
  const tracker = useTripTracker(workspaceId, gpsSamplingIntervalSeconds);
  const [selectedJourneyId, setSelectedJourneyId] = useState(defaultJourneyId ?? Tours[0]?.id ?? "");
  const [tickingNow, setTickingNow] = useState(() => Date.now());
  const [lastSummary, setLastSummary] = useState<CompletedTripSummary | null>(null);
  const [createdDraftHref, setCreatedDraftHref] = useState<string | null>(null);
  const [isEndingTrip, setIsEndingTrip] = useState(false);
  const endTripInFlightRef = useRef(false);
  const { activeSuggestion, dismiss } = useStopSuggestions(
    tracker.session?.samples ?? [],
    tickingNow,
  );

  useEffect(() => {
    if (!tracker.isTracking) {
      return;
    }

    const timer = window.setInterval(() => {
      setTickingNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [tracker.isTracking]);

  useEffect(() => {
    if (!tracker.lastError) {
      return;
    }

    if (tracker.lastError === "location-permission-denied") {
      toast.error("Location permission denied. Trip can run, but distance updates are paused.");
      return;
    }

    if (tracker.lastError === "location-unsupported") {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }

    toast.error("Unable to read your location right now.");
  }, [tracker.lastError]);

  const selectedJourney = useMemo(
    () => Tours.find((Tour) => Tour.id === selectedJourneyId),
    [Tours, selectedJourneyId],
  );

  const liveElapsed = tracker.session
    ? Math.max(0, tickingNow - new Date(tracker.session.startedAt).getTime())
    : tracker.elapsedMs;
  const resumedBackgroundLabel = formatBackgroundDuration(tracker.resumedAfterBackgroundMs);

  const wakeLockHelperText = useMemo(() => {
    if (!tracker.wakeLockSupported) {
      return "Not available in this browser.";
    }

    if (!tracker.isTracking) {
      return tracker.wakeLockEnabled
        ? "Will turn on when you start a trip."
        : "Optional. Helps keep this screen active during a trip.";
    }

    if (tracker.wakeLockActive) {
      return "Screen awake is active.";
    }

    if (tracker.wakeLockError) {
      return "Couldn’t keep the screen awake right now.";
    }

    if (tracker.wakeLockEnabled) {
      return "Trying to keep this screen active while tracking.";
    }

    return "Optional. Helps reduce pauses while this screen stays open.";
  }, [tracker.isTracking, tracker.wakeLockActive, tracker.wakeLockEnabled, tracker.wakeLockError, tracker.wakeLockSupported]);

  const onStart = async () => {
    const created = await tracker.startTrip({
      journeyId: selectedJourney?.id,
      journeySlug: selectedJourney?.slug,
      journeyTitle: selectedJourney?.title,
    });

    if (created) {
      setLastSummary(null);
      setCreatedDraftHref(null);
      toast.success("Trip tracking started.");
      return;
    }

    toast.message("A trip is already active for this workspace.");
  };

  const onEnd = async () => {
    if (endTripInFlightRef.current) {
      return;
    }

    try {
      endTripInFlightRef.current = true;
      setIsEndingTrip(true);

      const summary = await tracker.endTrip();
      if (!summary) {
        return;
      }

      setLastSummary(summary);

      const response = await fetch("/api/trips/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journeyId: summary.journeyId,
          journeyTitle: summary.journeyTitle,
          vehicleId: defaultVehicleId,
          startedAt: summary.startedAt,
          endedAt: summary.endedAt,
          distanceKm: summary.distanceKm,
          samples: summary.samples,
          routePolyline: summary.routePolyline,
          stopSuggestions: summary.stopSuggestions,
        }),
      });

      if (!response.ok) {
        toast.error("Trip ended, but we could not auto-create a driving log draft.");
        return;
      }

      const payload = (await response.json()) as { editHref?: string };
      if (payload.editHref) {
        setCreatedDraftHref(payload.editHref);
        toast.success("Trip ended. Driving log draft created.");
        return;
      }

      toast.success("Trip ended.");
    } catch {
      toast.error("Trip ended, but we could not reach the server for draft creation.");
    } finally {
      endTripInFlightRef.current = false;
      setIsEndingTrip(false);
    }
  };

  return (
    <Card
      className={`border-border/75 bg-linear-to-br transition-[background-color,box-shadow,border-color,transform] duration-300 ${
        tracker.isTracking
          ? "from-primary/12 via-card to-primary/8 ring-1 ring-primary/25 shadow-[0_18px_36px_rgba(36,48,40,0.14)] lg:shadow-[0_22px_44px_rgba(36,48,40,0.18)]"
          : "from-card via-card to-muted/18 shadow-[0_14px_30px_rgba(36,48,40,0.1)]"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-light tracking-tight text-foreground sm:text-[1.75rem]">
              {tracker.isTracking ? "Trip in progress" : "Start your Tour"}
            </CardTitle>
            <p className="text-sm text-muted-foreground/90">
              {tracker.isTracking
                ? "Track your drive until you arrive at your next Gig."
                : "Start tracking when you head out."}
            </p>
          </div>
          {tracker.isTracking ? (
            <Badge className="gap-1.5">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-45" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
              </span>
              Live
            </Badge>
          ) : (
            <Badge variant="outline">Ready to start</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {!tracker.geolocationSupported ? (
          <p className="rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-muted-foreground">
            Location tracking is unavailable in this browser. You can keep using manual Tour and log entry.
          </p>
        ) : null}

        {showJourneyPicker && Tours.length > 1 && !tracker.isTracking ? (
          <div className="space-y-2">
            <label htmlFor="trip-Tour" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tour
            </label>
            <select
              id="trip-Tour"
              className="w-full"
              value={selectedJourneyId}
              onChange={(event) => setSelectedJourneyId(event.currentTarget.value)}
            >
              {Tours.map((Tour) => (
                <option key={Tour.id} value={Tour.id}>
                  {Tour.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-3 rounded-lg border border-border/70 bg-background/65 px-3 py-3">
          {tracker.isTracking ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mobile web tracking</p>
              <p className="text-xs text-muted-foreground">Tracking works best while this screen stays open.</p>
              <p className="text-xs text-muted-foreground">Switching apps or locking your phone may pause GPS updates.</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1 pr-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Keep screen awake during trip</p>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Mobile assist</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{wakeLockHelperText}</p>
            </div>
            <Switch
              aria-label="Keep screen awake during trip"
              checked={tracker.wakeLockEnabled}
              disabled={!tracker.wakeLockSupported}
              onCheckedChange={(checked) => tracker.setWakeLockEnabled(Boolean(checked))}
            />
          </div>
        </div>

        {tracker.isTracking && tracker.resumedAfterBackgroundMs !== null ? (
          <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Tracking resumed{resumedBackgroundLabel ? ` after ${resumedBackgroundLabel} in the background.` : "."}
          </p>
        ) : null}

        {tracker.isTracking && tracker.trackingMayBePaused ? (
          <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Tracking may have paused while the app was in the background.
          </p>
        ) : null}

        {tracker.session ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3.5">
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatDistanceKm(tracker.session.totalDistanceKm)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3.5">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatElapsed(liveElapsed)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3.5">
              <p className="text-xs text-muted-foreground">Last GPS update</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatLastUpdate(tracker.session.lastSampleAt)}</p>
            </div>
          </div>
        ) : null}

        {tracker.isTracking && tracker.session ? (
          <TripLiveMap
            samples={tracker.session.samples}
            suggestedStop={activeSuggestion ?? null}
          />
        ) : null}

        {tracker.isTracking && activeSuggestion ? (
          <StopSuggestionCard
            suggestion={activeSuggestion}
            journeyId={tracker.session?.journeyId}
            onDismiss={() => dismiss(activeSuggestion.id)}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {!tracker.isTracking && !isEndingTrip ? (
            <Button type="button" onClick={() => void onStart()} disabled={!Tours.length} className="h-12 px-6 text-base">
              Start trip
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void onEnd()}
                disabled={isEndingTrip}
                className="h-12 px-6 text-base"
              >
                {isEndingTrip ? "Ending trip..." : "End trip"}
              </Button>
              {tracker.isTracking ? (
                <>
                  <Link href="/dashboard/Tours" className={buttonVariants({ variant: "outline", className: "h-12" })}>
                    Add Gig
                  </Link>
                  <Link href="/dashboard/media" className={buttonVariants({ variant: "outline", className: "h-12" })}>
                    Capture moment
                  </Link>
                </>
              ) : null}
            </>
          )}
          {!tracker.isTracking && !Tours.length ? (
            <p className="text-xs text-muted-foreground">Create a Tour before starting trip tracking.</p>
          ) : null}
        </div>

        {lastSummary ? (
          <div className="space-y-2 rounded-md border border-emerald-300/70 bg-emerald-50/40 px-3 py-2 transition-all duration-300">
            <p className="font-medium text-emerald-900">Trip recorded</p>
            <p className="text-xs text-emerald-900/85">
              {formatDistanceKm(lastSummary.distanceKm)} • {formatElapsed(lastSummary.elapsedMs)}
            </p>
            {lastSummary.hadTrackingGaps ? (
              <p className="text-xs text-emerald-900/85">
                Some tracking gaps may have occurred while the app was not active.
              </p>
            ) : null}
            <Link
              href={createdDraftHref ?? "/dashboard/logs/driving"}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Review driving log
            </Link>
          </div>
        ) : null}

        {lastSummary?.stopSuggestions.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gig suggestions</p>
            <ul className="space-y-2">
              {lastSummary.stopSuggestions.map((Gig, index) => {
                const targetJourneyId = lastSummary.journeyId ?? selectedJourney?.id;
                const href = targetJourneyId
                  ? `/dashboard/Tours/${targetJourneyId}?lat=${Gig.latitude.toFixed(6)}&lng=${Gig.longitude.toFixed(6)}#add-Gig`
                  : undefined;

                return (
                  <li key={Gig.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/18 px-3 py-2">
                    <div>
                      <p className="font-medium">Gig {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {Gig.dwellMinutes} min dwell • {Gig.latitude.toFixed(4)}, {Gig.longitude.toFixed(4)}
                      </p>
                    </div>
                    {href ? (
                      <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Use for new Gig
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Link a Tour to use this Gig</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
