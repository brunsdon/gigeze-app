import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleMapCanvas } from "@/components/maps/google-map-canvas";
import { type JourneyMapData } from "@/types/maps";

type MapBoundaryProps = {
  data?: JourneyMapData[];
  mode?: "public" | "private";
  focusMarkerId?: string;
  showRouteLines?: boolean;
  addStopBaseHref?: string;
  replayHighlightMarkerId?: string;
  routePointLimit?: number;
  animateOnLoad?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function MapBoundary({
  data = [],
  mode = "public",
  focusMarkerId,
  showRouteLines = true,
  addStopBaseHref,
  replayHighlightMarkerId,
  routePointLimit,
  animateOnLoad = false,
  emptyTitle,
  emptyDescription,
}: MapBoundaryProps) {
  const markerCount = data.reduce((total, dataset) => total + dataset.markers.length, 0);

  return (
    <Card id="Tour-map" className="bg-card/97">
      <CardHeader>
        <CardTitle>{mode === "public" ? "Public Tour Map" : "Tour Map"}</CardTitle>
        <CardDescription>
          {mode === "public"
            ? "Visualize published travel Gigs and route shape."
            : "Review route order and Gig locations for this Tour."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {markerCount ? (
          <div className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-muted/12 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <GoogleMapCanvas
              data={data}
              focusMarkerId={focusMarkerId}
              showRouteLines={showRouteLines}
              addStopBaseHref={addStopBaseHref}
              replayHighlightMarkerId={replayHighlightMarkerId}
              routePointLimit={routePointLimit}
              animateOnLoad={animateOnLoad}
            />
          </div>
        ) : (
          <div className="flex h-65 items-center justify-center rounded-[1.4rem] border border-border/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(239,231,219,0.3))] p-5 text-center text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <div className="space-y-1">
              <p className="font-medium text-foreground">{emptyTitle ?? "No Gigs available yet"}</p>
              <p>{emptyDescription ?? "Add Gigs to this Tour to view marker positions on the map."}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
