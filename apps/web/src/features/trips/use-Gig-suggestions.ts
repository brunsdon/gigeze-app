"use client";

import { useMemo, useState } from "react";
import { detectStopSuggestions, type TripSample, type TripStopSuggestion } from "@/features/trips/tracking";

/**
 * Maximum age (ms) for a completed dwell cluster to still be surfaced as a
 * suggestion. Clusters older than this window are silently skipped — the user
 * has moved on and nagging them is unhelpful.
 */
const MAX_SUGGESTION_AGE_MS = 30 * 60 * 1000; // 30 minutes

export type { TripStopSuggestion };

/**
 * Returns at most one live Gig suggestion derived from the current trip's GPS
 * samples, plus a `dismiss` callback to suppress a given suggestion for the
 * remainder of the active trip.
 *
 * `currentTime` should be a regularly-updating timestamp from the parent
 * component (e.g. a `tickingNow` state). This keeps `Date.now()` out of the
 * memo body while ensuring the 30-minute age window is evaluated at render time.
 *
 * Design decisions:
 * - Detection reuses `detectStopSuggestions` (no duplicate logic).
 * - Only the most recent qualifying cluster is surfaced at any time.
 * - Dismissed IDs are kept in a ref; `dismissEpoch` increments to bust the
 *   memo without re-running detection unnecessarily.
 */
export function useStopSuggestions(samples: TripSample[], currentTime: number) {
  // Dismissed IDs are stored in state so they're a valid `useMemo` dependency.
  // Using a Set inside state: we always replace with a new Set on dismiss so
  // React sees the reference change and re-evaluates the memo.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  const activeSuggestion = useMemo(() => {
    if (samples.length === 0) {
      return null;
    }

    const all = detectStopSuggestions(samples);

    // Walk from newest to oldest — surface first qualifying suggestion
    for (let index = all.length - 1; index >= 0; index -= 1) {
      const candidate = all[index];

      if (dismissed.has(candidate.id)) {
        continue;
      }

      const endedAt = new Date(candidate.endedAt).getTime();
      if (!Number.isFinite(endedAt) || currentTime - endedAt > MAX_SUGGESTION_AGE_MS) {
        continue;
      }

      return candidate;
    }

    return null;
  }, [samples, currentTime, dismissed]);

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  return { activeSuggestion, dismiss };
}
