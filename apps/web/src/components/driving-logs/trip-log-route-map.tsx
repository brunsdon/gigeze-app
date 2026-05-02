"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDrivingLogRouteCoordinates, type DrivingLogRouteSample } from "@/features/driving-logs/route-preview";
import { mapEnv } from "@/lib/maps/env";
import { loadGoogleMapsApi } from "@/lib/maps/google-maps-loader";

type LatLngLiteral = { lat: number; lng: number };

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

type GoogleLatLngBounds = {
  extend: (point: LatLngLiteral) => void;
  isEmpty: () => boolean;
};

type GooglePolyline = {
  setMap: (map: GoogleMap | null) => void;
};

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
};

type GoogleAdvancedMarker = {
  map: GoogleMap | null;
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
      gestureHandling: string;
      clickableIcons: boolean;
    },
  ) => GoogleMap;
  Marker?: new (options: {
    map: GoogleMap;
    position: LatLngLiteral;
    title: string;
    label?: string;
  }) => GoogleMarker;
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
  }) => GooglePolyline;
  LatLngBounds: new () => GoogleLatLngBounds;
};

type TripLogRouteMapProps = {
  distanceText: string;
  samples: DrivingLogRouteSample[];
};

function createLetterMarker(label: "A" | "B") {
  const marker = document.createElement("div");
  marker.className =
    "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#1d5c49] text-xs font-black text-white shadow-[0_2px_8px_rgba(20,38,31,0.35)]";
  marker.textContent = label;
  return marker;
}

export function TripLogRouteMap({ distanceText, samples }: TripLogRouteMapProps) {
  const hasApiKey = Boolean(mapEnv.googleMapsApiKey);
  const coordinates = useMemo(() => getDrivingLogRouteCoordinates(samples), [samples]);
  const hasRoute = coordinates.length >= 2;
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error" | "missing-key">(
    hasApiKey ? (hasRoute ? "loading" : "idle") : "missing-key",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const hasFitRouteRef = useRef(false);

  useEffect(() => {
    if (!hasRoute || !hasApiKey || loadState !== "loading") {
      return;
    }

    let mounted = true;

    loadGoogleMapsApi(mapEnv.googleMapsApiKey)
      .then(() => {
        if (mounted) {
          setLoadError(null);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load Google Maps.");
          setLoadState("error");
        }
      });

    return () => {
      mounted = false;
    };
  }, [hasApiKey, hasRoute, loadState]);

  useEffect(() => {
    if (loadState !== "ready" || !containerRef.current || !hasRoute) {
      return;
    }

    const maps = window.google?.maps as GoogleMapsApi | undefined;
    if (!maps) {
      window.setTimeout(() => {
        setLoadError("Google Maps loaded, but the Maps API is unavailable.");
        setLoadState("error");
      }, 0);
      return;
    }

    cleanupRef.current.forEach((cleanup) => cleanup());
    cleanupRef.current = [];

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        center: coordinates[0],
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
        clickableIcons: false,
      });
    }

    const map = mapRef.current;
    const polyline = new maps.Polyline({
      path: coordinates,
      geodesic: true,
      strokeColor: "#1d7a5c",
      strokeOpacity: 0.94,
      strokeWeight: 5,
    });
    polyline.setMap(map);
    cleanupRef.current.push(() => polyline.setMap(null));

    const start = coordinates[0];
    const finish = coordinates[coordinates.length - 1];

    if (maps.marker?.AdvancedMarkerElement) {
      const startMarker = new maps.marker.AdvancedMarkerElement({
        map,
        position: start,
        title: "Trip start",
        content: createLetterMarker("A"),
      });
      const finishMarker = new maps.marker.AdvancedMarkerElement({
        map,
        position: finish,
        title: "Trip finish",
        content: createLetterMarker("B"),
      });
      cleanupRef.current.push(() => {
        startMarker.map = null;
        finishMarker.map = null;
      });
    } else if (maps.Marker) {
      const startMarker = new maps.Marker({ map, position: start, title: "Trip start", label: "A" });
      const finishMarker = new maps.Marker({ map, position: finish, title: "Trip finish", label: "B" });
      cleanupRef.current.push(() => {
        startMarker.setMap(null);
        finishMarker.setMap(null);
      });
    }

    if (!hasFitRouteRef.current) {
      const bounds = new maps.LatLngBounds();
      coordinates.forEach((coordinate) => bounds.extend(coordinate));
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 56);
      }
      hasFitRouteRef.current = true;
    }
  }, [coordinates, hasRoute, loadState]);

  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
    };
  }, []);

  if (!hasRoute) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
        <p className="text-base font-semibold text-foreground">Route not captured</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          No GPS samples are available for this trip yet. Distance and odometer details remain available in the summary.
        </p>
      </div>
    );
  }

  if (loadState === "missing-key") {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
        <p className="text-base font-semibold text-foreground">Map unavailable</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to render Google Maps route previews.
        </p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
        <p className="text-base font-semibold text-foreground">Unable to load route map</p>
        {loadError ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{loadError}</p> : null}
        <button
          type="button"
          className="mt-3 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          onClick={() => setLoadState("loading")}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[280px] overflow-hidden rounded-lg border border-border/70 bg-muted/20">
      <div ref={containerRef} className="h-full w-full" />
      {loadState !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/25 text-sm font-medium text-muted-foreground">
          Loading route map...
        </div>
      ) : null}
      <div className="absolute right-3 top-3 rounded-lg border border-white/10 bg-[#17231e]/90 px-4 py-3 text-white shadow-lg backdrop-blur">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-white/72">Distance</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{distanceText}</p>
        <p className="mt-1 text-xs font-medium text-white/72">{samples.length} samples</p>
      </div>
    </div>
  );
}
