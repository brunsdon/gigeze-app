"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/ui/loading-state";
import { mapEnv } from "@/lib/maps/env";
import { loadGoogleMapsApi } from "@/lib/maps/google-maps-loader";
import { type JourneyMapData } from "@/types/maps";

type GoogleMapCanvasProps = {
  data: JourneyMapData[];
  showRouteLines?: boolean;
  focusMarkerId?: string;
  addStopBaseHref?: string;
  replayHighlightMarkerId?: string;
  routePointLimit?: number;
  animateOnLoad?: boolean;
};

type LatLngLiteral = { lat: number; lng: number };

type GoogleMap = {
  panTo: (position: LatLngLiteral) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  addListener: (
    eventName: "click",
    handler: (event: { latLng?: { lat: () => number; lng: () => number } }) => void,
  ) => GoogleMapsEventListener;
};

type GoogleMapsEventListener = {
  remove: () => void;
};

type GoogleLegacyMarker = {
  addListener: (eventName: string, handler: () => void) => void;
  setMap: (map: GoogleMap | null) => void;
};

type GoogleAdvancedMarker = {
  map: GoogleMap | null;
  addListener: (eventName: string, handler: () => void) => GoogleMapsEventListener;
};

type GooglePolyline = {
  setMap: (map: GoogleMap | null) => void;
};

type GooglePolylineIconSequence = {
  icon: {
    path: number | string;
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    scale?: number;
  };
  offset: string;
  repeat: string;
};

type GoogleLatLngBounds = {
  extend: (point: LatLngLiteral) => void;
  isEmpty: () => boolean;
};

type GoogleMapsApi = {
  Map: new (
    element: HTMLElement,
    options: {
      center: LatLngLiteral;
      zoom: number;
      mapTypeControl: boolean;
      streetViewControl: boolean;
      fullscreenControl: boolean;
    },
  ) => GoogleMap;
  Marker: new (options: {
    map: GoogleMap;
    position: LatLngLiteral;
    title: string;
    label?: string;
  }) => GoogleLegacyMarker;
  marker?: {
    AdvancedMarkerElement: new (options: {
      map: GoogleMap;
      position: LatLngLiteral;
      title: string;
      content?: HTMLElement;
    }) => GoogleAdvancedMarker;
  };
  Polyline: new (options: {
    path: LatLngLiteral[];
    geodesic: boolean;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    icons?: GooglePolylineIconSequence[];
  }) => GooglePolyline;
  LatLngBounds: new () => GoogleLatLngBounds;
  SymbolPath: {
    FORWARD_CLOSED_ARROW: number;
  };
};

function flattenMarkers(datasets: JourneyMapData[]) {
  return datasets.flatMap((dataset) => dataset.markers);
}

function getPinBadgeText(orderIndex?: number, isCurrent?: boolean) {
  if (isCurrent) {
    return "Now";
  }

  if (!orderIndex) {
    return null;
  }

  return `S${orderIndex}`;
}

function createAdvancedMarkerContent(label: string, orderIndex?: number, isCurrent?: boolean) {
  const badgeText = getPinBadgeText(orderIndex, isCurrent);
  if (!badgeText) {
    return undefined;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center gap-1.5";

  const badge = document.createElement("div");
  badge.className = isCurrent
    ? "flex h-7 min-w-8 items-center justify-center rounded-full border border-white px-2 text-[11px] font-semibold text-white shadow"
    : "flex h-7 min-w-8 items-center justify-center rounded-full border border-white px-2 text-[11px] font-semibold text-white shadow";
  badge.style.backgroundColor = "#3f7d58";
  badge.textContent = badgeText;

  const text = document.createElement("div");
  text.className = "hidden rounded-full border border-border/70 bg-background/95 px-2 py-0.5 text-[11px] font-medium text-foreground shadow sm:block";
  text.textContent = label;

  wrapper.appendChild(badge);
  wrapper.appendChild(text);

  return wrapper;
}

export function GoogleMapCanvas({
  data,
  showRouteLines = true,
  focusMarkerId,
  addStopBaseHref,
  replayHighlightMarkerId,
  routePointLimit,
  animateOnLoad = false,
}: GoogleMapCanvasProps) {
  const hasApiKey = Boolean(mapEnv.googleMapsApiKey);
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error" | "missing-key">(
    hasApiKey ? "loading" : "missing-key",
  );
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(focusMarkerId ?? null);
  const [selectedCoordinate, setSelectedCoordinate] = useState<LatLngLiteral | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerCleanupRef = useRef<Array<() => void>>([]);
  const polylineRef = useRef<GooglePolyline[]>([]);

  const allMarkers = useMemo(() => flattenMarkers(data), [data]);
  const currentMarker = replayHighlightMarkerId
    ? allMarkers.find((item) => item.id === replayHighlightMarkerId) ?? null
    : allMarkers.find((item) => item.isCurrent) ?? allMarkers.at(-1) ?? null;
  const effectiveSelectedMarkerId = focusMarkerId ?? selectedMarkerId ?? currentMarker?.id;
  const selectedMarker = allMarkers.find((item) => item.id === effectiveSelectedMarkerId) ?? null;

  useEffect(() => {
    if (!hasApiKey) {
      return;
    }

    let mounted = true;

    loadGoogleMapsApi(mapEnv.googleMapsApiKey)
      .then(() => {
        if (!mounted || !containerRef.current) {
          return;
        }

        const googleApi = window.google;
        if (!googleApi?.maps) {
          setLoadErrorMessage("Google Maps loaded, but the Maps API is unavailable.");
          setLoadingState("error");
          return;
        }

        const maps = googleApi.maps as GoogleMapsApi;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: { lat: -25.2744, lng: 133.7751 },
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }

        setLoadErrorMessage(null);
        setLoadingState("ready");
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadErrorMessage(error instanceof Error ? error.message : "Failed to load Google Maps script.");
          setLoadingState("error");
        }
      });

    return () => {
      mounted = false;
    };
  }, [hasApiKey, loadingState]);

  useEffect(() => {
    if (loadingState !== "ready" || !mapRef.current) {
      return;
    }

    const mapInstance = mapRef.current;

    const googleApi = window.google;
    if (!googleApi?.maps) {
      return;
    }

    const maps = googleApi.maps as GoogleMapsApi;

    markerCleanupRef.current.forEach((cleanup) => {
      cleanup();
    });
    markerCleanupRef.current = [];

    polylineRef.current.forEach((line) => {
      line.setMap(null);
    });
    polylineRef.current = [];

    const bounds = new maps.LatLngBounds();
    const mapClickListener = addStopBaseHref
      ? mapInstance.addListener("click", (event) => {
          if (!event.latLng) {
            return;
          }

          setSelectedCoordinate({
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          });
        })
      : null;

    data.forEach((dataset) => {
      dataset.markers.forEach((markerData) => {
        const position = { lat: markerData.lat, lng: markerData.lng };
        const isReplayCurrent = replayHighlightMarkerId
          ? markerData.id === replayHighlightMarkerId
          : markerData.isCurrent;
        const handleMarkerClick = () => {
          setSelectedMarkerId(markerData.id);
          mapInstance.panTo(position);
        };

        if (maps.marker?.AdvancedMarkerElement) {
          const marker = new maps.marker.AdvancedMarkerElement({
            map: mapInstance,
            position,
            title: markerData.label,
            content: createAdvancedMarkerContent(markerData.label, markerData.orderIndex, isReplayCurrent),
          });

          const listener = marker.addListener("click", handleMarkerClick);
          markerCleanupRef.current.push(() => {
            listener.remove();
            marker.map = null;
          });
        } else {
          const marker = new maps.Marker({
            map: mapInstance,
            position,
            title: isReplayCurrent ? `Current location: ${markerData.label}` : markerData.label,
            label: getPinBadgeText(markerData.orderIndex, isReplayCurrent) ?? undefined,
          });

          marker.addListener("click", handleMarkerClick);
          markerCleanupRef.current.push(() => {
            marker.setMap(null);
          });
        }

        bounds.extend({ lat: markerData.lat, lng: markerData.lng });
      });

      if (showRouteLines && dataset.routePoints.length > 1) {
        const routePoints = typeof routePointLimit === "number"
          ? dataset.routePoints.slice(0, Math.max(1, Math.min(routePointLimit, dataset.routePoints.length)))
          : dataset.routePoints;

        if (routePoints.length <= 1) {
          return;
        }

        const polyline = new maps.Polyline({
          path: routePoints.map((point) => ({ lat: point.lat, lng: point.lng })),
          geodesic: true,
          strokeColor: "#3f7d58",
          strokeOpacity: 0.95,
          strokeWeight: 4,
          icons: [
            {
              icon: {
                path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
                fillColor: "#2d5a40",
                fillOpacity: 0.95,
                strokeColor: "#1d4ed8",
                strokeOpacity: 0.95,
                scale: 2.4,
              },
              offset: "0",
              repeat: "120px",
            },
          ],
        });

        polyline.setMap(mapInstance);
        polylineRef.current.push(polyline);
      }
    });

    if (!bounds.isEmpty()) {
      mapInstance.fitBounds(bounds, 56);
    }

    return () => {
      mapClickListener?.remove();
    };
  }, [addStopBaseHref, data, loadingState, replayHighlightMarkerId, routePointLimit, showRouteLines]);

  useEffect(() => {
    if (!focusMarkerId || !mapRef.current) {
      return;
    }

    const markerData = allMarkers.find((item) => item.id === focusMarkerId);

    if (markerData) {
      const mapInstance = mapRef.current;
      if (!mapInstance) {
        return;
      }

      mapInstance.panTo({ lat: markerData.lat, lng: markerData.lng });
      mapInstance.setZoom(Math.max(mapInstance.getZoom() ?? 8, 8));
    }
  }, [allMarkers, focusMarkerId]);

  useEffect(() => {
    if (!replayHighlightMarkerId || !mapRef.current) {
      return;
    }

    const markerData = allMarkers.find((item) => item.id === replayHighlightMarkerId);
    if (!markerData) {
      return;
    }

    mapRef.current.panTo({ lat: markerData.lat, lng: markerData.lng });
  }, [allMarkers, replayHighlightMarkerId]);

  if (loadingState === "missing-key") {
    return (
      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable map rendering.
      </div>
    );
  }

  if (loadingState === "error") {
    return (
      <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p>Unable to load Google Maps right now.</p>
        {loadErrorMessage ? <p className="text-xs">{loadErrorMessage}</p> : null}
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
          onClick={() => setLoadingState("loading")}
        >
          Retry map load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`relative h-90 w-full rounded-md border bg-muted/20 transition-[opacity,transform] duration-220 ${
          animateOnLoad && loadingState !== "ready" ? "scale-[0.985] opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />
        {loadingState === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <LoadingIndicator variant="hourglass" label="Loading map..." />
          </div>
        ) : null}
      </div>

      {selectedMarker ? (
        <div className="rounded-md border bg-background p-3 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">{selectedMarker.label}</p>
            {(replayHighlightMarkerId ? selectedMarker.id === replayHighlightMarkerId : selectedMarker.isCurrent) ? <Badge>Current location</Badge> : null}
            {selectedMarker.journeyTitle ? <Badge variant="secondary">{selectedMarker.journeyTitle}</Badge> : null}
          </div>
          {selectedMarker.description ? <p className="mt-1 text-muted-foreground">{selectedMarker.description}</p> : null}
          {selectedMarker.href ? (
            <Link className="mt-2 inline-block text-sm font-medium text-primary hover:underline" href={selectedMarker.href}>
              View Tour
            </Link>
          ) : null}
        </div>
      ) : null}

      {selectedCoordinate && addStopBaseHref ? (
        <div className="rounded-md border bg-background p-3 text-sm">
          <p className="font-medium">Pinned map point</p>
          <p className="mt-1 text-muted-foreground">
            {selectedCoordinate.lat.toFixed(5)}, {selectedCoordinate.lng.toFixed(5)}
          </p>
          <Link
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            href={`${addStopBaseHref}?lat=${selectedCoordinate.lat.toFixed(6)}&lng=${selectedCoordinate.lng.toFixed(6)}#add-Gig`}
          >
            Add Gig here
          </Link>
        </div>
      ) : null}

      {allMarkers.length ? (
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gig labels</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => {
                  setSelectedMarkerId(marker.id);
                  mapRef.current?.panTo({ lat: marker.lat, lng: marker.lng });
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  replayHighlightMarkerId ? marker.id === replayHighlightMarkerId : marker.isCurrent
                    ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                    : "border-border/80 bg-muted/25 text-muted-foreground hover:bg-muted/45"
                }`}
              >
                <span>{getPinBadgeText(marker.orderIndex, replayHighlightMarkerId ? marker.id === replayHighlightMarkerId : marker.isCurrent) ?? "-"}</span>
                <span>{marker.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
