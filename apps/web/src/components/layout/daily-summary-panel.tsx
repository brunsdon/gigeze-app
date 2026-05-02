"use client";

import { formatDistanceKm } from "@gigeze/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DailySummaryPanelProps = {
  drivingLogs: Array<{ date: Date; startOdometer: number; endOdometer: number }>;
  Gigs: Array<{ createdAt: Date }>;
  mediaItems: Array<{ createdAt: Date }>;
};

function isSameLocalDay(value: Date, today: Date) {
  return (
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth() &&
    value.getDate() === today.getDate()
  );
}

export function DailySummaryPanel({ drivingLogs, Gigs, mediaItems }: DailySummaryPanelProps) {
  const today = new Date();
  const drivingDistanceToday = drivingLogs
    .filter((log) => isSameLocalDay(new Date(log.date), today))
    .reduce((sum, log) => sum + (log.endOdometer - log.startOdometer), 0);
  const stopsToday = Gigs.filter((Gig) => isSameLocalDay(new Date(Gig.createdAt), today)).length;
  const mediaToday = mediaItems.filter((item) => isSameLocalDay(new Date(item.createdAt), today)).length;

  if (drivingDistanceToday <= 0 && stopsToday <= 0 && mediaToday <= 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today so far</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Distance travelled</p>
            <p className="text-base font-medium">{formatDistanceKm(drivingDistanceToday)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gigs added</p>
            <p className="text-base font-medium">{stopsToday}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Moments added</p>
            <p className="text-base font-medium">{mediaToday}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
