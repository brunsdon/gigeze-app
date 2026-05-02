"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buildPassiveActivitySuggestions } from "@/lib/dashboard/predictive";

const DISMISSED_PREDICTIVE_SUGGESTIONS_KEY = "gigeze.dismissed-predictive-suggestions.v1";

type PassiveActivitySuggestionsProps = {
  activeJourney:
    | {
        id: string;
        Gigs: Array<{
          id: string;
          title: string;
          locationName?: string | null;
          latitude: number | { toNumber(): number };
          longitude: number | { toNumber(): number };
          arrivalDate?: Date | null;
          departureDate?: Date | null;
          createdAt?: Date;
        }>;
      }
    | undefined;
  drivingLogs: Array<{ date: Date }>;
};

function readDismissedIds() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  const raw = window.localStorage.getItem(DISMISSED_PREDICTIVE_SUGGESTIONS_KEY);
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function writeDismissedIds(ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DISMISSED_PREDICTIVE_SUGGESTIONS_KEY, JSON.stringify(ids));
}

export function PassiveActivitySuggestions({ activeJourney, drivingLogs }: PassiveActivitySuggestionsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readDismissedIds());

  const suggestions = useMemo(() => {
    const next = buildPassiveActivitySuggestions(activeJourney, drivingLogs);
    return next.filter((item) => !dismissedIds.includes(item.id));
  }, [activeJourney, dismissedIds, drivingLogs]);

  function dismissSuggestion(id: string) {
    setDismissedIds((previous) => {
      if (previous.includes(id)) {
        return previous;
      }

      const next = [...previous, id];
      writeDismissedIds(next);
      return next;
    });
  }

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => (
        <Alert key={suggestion.id} className="bg-card/96">
          <AlertTitle>{suggestion.title}</AlertTitle>
          <AlertDescription>{suggestion.description}</AlertDescription>
          <AlertAction className="static mt-2 flex flex-wrap gap-2 sm:absolute sm:top-2 sm:right-2 sm:mt-0">
            <Link href={suggestion.href} className={buttonVariants({ size: "sm", variant: "outline" })}>
              {suggestion.actionLabel}
            </Link>
            <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(suggestion.id)}>
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      ))}
    </div>
  );
}