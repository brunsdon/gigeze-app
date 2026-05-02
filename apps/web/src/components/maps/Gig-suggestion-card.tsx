"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { type TripStopSuggestion } from "@/features/trips/use-Gig-suggestions";

type StopSuggestionCardProps = {
  suggestion: TripStopSuggestion;
  journeyId?: string;
  onDismiss: () => void;
  onSaved?: () => void;
};

function buildAddStopHref(suggestion: TripStopSuggestion, journeyId?: string): string {
  const lat = suggestion.latitude.toFixed(6);
  const lng = suggestion.longitude.toFixed(6);

  if (journeyId) {
    return `/dashboard/Tours/${journeyId}?lat=${lat}&lng=${lng}#add-Gig`;
  }

  return `/dashboard/Tours`;
}

function formatDwell(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function StopSuggestionCard({
  suggestion,
  journeyId,
  onDismiss,
}: StopSuggestionCardProps) {
  const addStopHref = buildAddStopHref(suggestion, journeyId);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300/50 bg-amber-50/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800/40 dark:bg-amber-950/20">
      <div className="flex min-w-0 items-start gap-2.5">
        <MapPin
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600/80 dark:text-amber-400/80"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Looks like you stopped here</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDwell(suggestion.dwellMinutes)} Gig detected — save it to your Tour?
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          Not now
        </Button>
        <Link
          href={addStopHref}
          className={buttonVariants({
            size: "sm",
            className: "h-8 bg-amber-700/90 px-3 text-xs text-white hover:bg-amber-700 dark:bg-amber-600/80 dark:hover:bg-amber-600",
          })}
        >
          Save Gig
        </Link>
      </div>
    </div>
  );
}
