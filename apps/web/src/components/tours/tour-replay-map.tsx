"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMapCanvas } from "@/components/maps/google-map-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type JourneyMapData } from "@/types/maps";

type JourneyReplayMapProps = {
  mapData: JourneyMapData;
};

export function JourneyReplayMap({ mapData }: JourneyReplayMapProps) {
  const orderedMarkers = useMemo(
    () => [...mapData.markers].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [mapData.markers],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || orderedMarkers.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((current) => {
        if (current >= orderedMarkers.length - 1) {
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 1100);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlaying, orderedMarkers.length]);

  const currentMarker = orderedMarkers[currentIndex] ?? orderedMarkers[0] ?? null;
  const routePointLimit = Math.max(1, currentIndex + 1);

  return (
    <Card className="bg-card/97">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Tour replay</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsPlaying((value) => !value)} disabled={orderedMarkers.length < 2}>
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentIndex(0);
                setIsPlaying(false);
              }}
              disabled={orderedMarkers.length < 2}
            >
              Restart
            </Button>
          </div>
        </div>
        {currentMarker ? (
          <p className="text-sm text-muted-foreground">
            Now viewing Gig {Math.min(currentIndex + 1, orderedMarkers.length)} of {orderedMarkers.length}: {currentMarker.label}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Add at least one Gig to start replay mode.</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-muted/12 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <GoogleMapCanvas
            data={[mapData]}
            showRouteLines
            replayHighlightMarkerId={currentMarker?.id}
            routePointLimit={routePointLimit}
            animateOnLoad
          />
        </div>
      </CardContent>
    </Card>
  );
}
