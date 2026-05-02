"use client";

import { useMemo, useState } from "react";
import { formatDistanceKm } from "@gigeze/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateInputValue } from "@/lib/datetime";

type WeeklySummaryPanelProps = {
  distanceKm: number;
  stopsCount: number;
  mediaCount: number;
};

export function WeeklySummaryPanel({ distanceKm, stopsCount, mediaCount }: WeeklySummaryPanelProps) {
  const weekKey = useMemo(() => {
    const date = new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return `gigeze.weekly-summary.dismissed:${formatDateInputValue(start)}`;
  }, []);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(weekKey) === "true";
  });

  if (distanceKm <= 0 && stopsCount <= 0 && mediaCount <= 0) {
    return null;
  }

  if (dismissed) {
    return null;
  }

  return (
    <Card className="bg-card/96">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">This week on the road</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            window.localStorage.setItem(weekKey, "true");
            setDismissed(true);
          }}
        >
          Dismiss
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Distance</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatDistanceKm(distanceKm)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Gigs</p>
            <p className="mt-1 text-base font-semibold text-foreground">{stopsCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Moments</p>
            <p className="mt-1 text-base font-semibold text-foreground">{mediaCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
