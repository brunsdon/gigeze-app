"use client";

import { useEffect, useRef, useState } from "react";
import { buildRoutePolyline, type TripSample } from "@/features/trips/tracking";
import { mapEnv } from "@/lib/maps/env";
import { loadGoogleMapsApi } from "@/lib/maps/google-maps-loader";

// ---- Minimal local type stubs for the Google Maps JS API subset we use ----

type LatLng = { lat: number; lng: number };

type GMapInstance = {
  panTo: (pos: LatLng) => void;
  fitBounds: (bounds: GLatLngBounds, padding?: number) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
};

type GLatLngBounds = {
  extend: (point: LatLng) => void;
  isEmpty: () => boolean;
};

type GPolyline = {
  setMap: (map: GMapInstance | null) => void;
};

type GAdvancedMarker = {
  map: GMapInstance | null;
};

type GMarker = {
  setMap: (map: GMapInstance | null) => void;
};

type GMapsApi = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMapInstance;
  Polyline: new (opts: Record<string, unknown>) => GPolyline;
  LatLngBounds: new () => GLatLngBounds;
  marker?: {
    AdvancedMarkerElement: new (opts: Record<string, unknown>) => GAdvancedMarker;
  };
  Marker?: new (opts: Record<string, unknown>) => GMarker;
};

// ---- Marker DOM element builders ----

function buildStartMarkerEl(): HTMLElement {
  const el = document.createElement("div");
  el.title = "Trip start";
  el.style.cssText =
    "width:11px;height:11px;border-radius:9999px;background-color:#5a8f72;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.28);";
  return el;
}

function buildSuggestedStopMarkerEl(): HTMLElement {
  const outer = document.createElement("div");
  outer.title = "Possible Gig detected";
  outer.style.cssText =
    "position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center;";

  // Subtle amber ring
  const ring = document.createElement("span");
  ring.style.cssText =
    "position:absolute;inset:0;border-radius:9999px;background-color:#d97706;opacity:0.18;";

  // Solid amber dot — intentionally smaller and lighter than the current-location marker
  const dot = document.createElement("span");
  dot.style.cssText =
    "position:relative;width:10px;height:10px;border-radius:9999px;background-color:#d97706;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.22);opacity:0.82;";

  outer.appendChild(ring);
  outer.appendChild(dot);
  return outer;
}

function buildCurrentMarkerEl(): HTMLElement {
  const outer = document.createElement("div");
  outer.title = "Current location";
  outer.style.cssText =
    "position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;";

  // Pulsing ring — animate-ping keyframe is already in CSS bundle
  const ring = document.createElement("span");
  ring.className = "animate-ping";
  ring.style.cssText =
    "position:absolute;inset:0;border-radius:9999px;background-color:#2d5a40;opacity:0.4;";

  // Solid dot
  const dot = document.createElement("span");
  dot.style.cssText =
    "position:relative;width:14px;height:14px;border-radius:9999px;background-color:#2d5a40;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.32);";

  outer.appendChild(ring);
  outer.appendChild(dot);
  return outer;
}

// ---- Component ----

type SuggestedStopPosition = {
  latitude: number;
  longitude: number;
};

type TripLiveMapProps = {
  samples: TripSample[];
  suggestedStop?: SuggestedStopPosition | null;
};

export function TripLiveMap({ samples, suggestedStop = null }: TripLiveMapProps) {
  const hasApiKey = Boolean(mapEnv.googleMapsApiKey);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    hasApiKey ? "loading" : "error",
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMapInstance | null>(null);
  const polylineRef = useRef<GPolyline | null>(null);
  const markerCleanupRef = useRef<Array<() => void>>([]);
  const suggestedMarkerCleanupRef = useRef<(() => void) | null>(null);
  const hasInitialFitRef = useRef(false);

  // Load the Google Maps API once
  useEffect(() => {
    if (!hasApiKey) {
      return;
    }

    let active = true;

    loadGoogleMapsApi(mapEnv.googleMapsApiKey)
      .then(() => {
        if (active) {
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [hasApiKey]);

  // Initialise the map instance once (guarded by mapRef check)
  useEffect(() => {
    if (loadState !== "ready" || !containerRef.current || mapRef.current) {
      return;
    }

    const maps = window.google?.maps as GMapsApi | undefined;
    if (!maps) {
      return;
    }

    mapRef.current = new maps.Map(containerRef.current, {
      // Default to centre of Australia — markers/polyline update immediately after
      center: { lat: -25.2744, lng: 133.7751 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      clickableIcons: false,
      // Require two-finger pan on mobile to avoid hijacking scroll
      gestureHandling: "cooperative",
    });
  }, [loadState]);

  // Keep markers and polyline in sync whenever the samples array changes
  useEffect(() => {
    if (loadState !== "ready" || !mapRef.current) {
      return;
    }

    const mapInstance = mapRef.current;
    const maps = window.google?.maps as GMapsApi | undefined;
    if (!maps) {
      return;
    }

    // Clear previous markers
    markerCleanupRef.current.forEach((fn) => fn());
    markerCleanupRef.current = [];

    // Clear previous polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (samples.length === 0) {
      return;
    }

    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    const startPos: LatLng = { lat: firstSample.latitude, lng: firstSample.longitude };
    const currentPos: LatLng = { lat: lastSample.latitude, lng: lastSample.longitude };

    // Reduce route to ≤ 80 points for compact map performance
    const routePoints = buildRoutePolyline(samples, 80);

    // Place markers — prefer AdvancedMarkerElement, fall back to legacy Marker
    if (maps.marker?.AdvancedMarkerElement) {
      const sm = new maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: startPos,
        title: "Trip start",
        content: buildStartMarkerEl(),
      });
      markerCleanupRef.current.push(() => {
        sm.map = null;
      });

      const cm = new maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: currentPos,
        title: "Current location",
        content: buildCurrentMarkerEl(),
      });
      markerCleanupRef.current.push(() => {
        cm.map = null;
      });
    } else if (maps.Marker) {
      const sm = new maps.Marker({
        map: mapInstance,
        position: startPos,
        title: "Trip start",
      });
      markerCleanupRef.current.push(() => {
        sm.setMap(null);
      });

      const cm = new maps.Marker({
        map: mapInstance,
        position: currentPos,
        title: "Current location",
      });
      markerCleanupRef.current.push(() => {
        cm.setMap(null);
      });
    }

    // Draw route polyline
    if (routePoints.length >= 2) {
      polylineRef.current = new maps.Polyline({
        path: routePoints.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        geodesic: true,
        strokeColor: "#3f7d58",
        strokeOpacity: 0.88,
        strokeWeight: 3,
      });
      polylineRef.current.setMap(mapInstance);
    }

    // Camera: fit to full route on first render, then just follow current position
    if (!hasInitialFitRef.current) {
      if (routePoints.length >= 2) {
        const bounds = new maps.LatLngBounds();
        routePoints.forEach((p) => {
          bounds.extend({ lat: p.latitude, lng: p.longitude });
        });
        mapInstance.fitBounds(bounds, 40);
        hasInitialFitRef.current = true;
      } else {
        // Single point – centre and zoom in
        mapInstance.panTo(currentPos);
        mapInstance.setZoom(13);
      }
    } else {
      mapInstance.panTo(currentPos);
    }
  }, [loadState, samples]);

  // Keep the suggested-Gig marker in sync independently of samples
  useEffect(() => {
    // Remove any previous suggested-Gig marker first
    suggestedMarkerCleanupRef.current?.();
    suggestedMarkerCleanupRef.current = null;

    if (!suggestedStop || loadState !== "ready" || !mapRef.current) {
      return;
    }

    const mapInstance = mapRef.current;
    const maps = window.google?.maps as GMapsApi | undefined;
    if (!maps) {
      return;
    }

    const pos: LatLng = { lat: suggestedStop.latitude, lng: suggestedStop.longitude };

    if (maps.marker?.AdvancedMarkerElement) {
      const marker = new maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: pos,
        title: "Possible Gig detected",
        content: buildSuggestedStopMarkerEl(),
      });
      suggestedMarkerCleanupRef.current = () => {
        marker.map = null;
      };
    } else if (maps.Marker) {
      const marker = new maps.Marker({
        map: mapInstance,
        position: pos,
        title: "Possible Gig detected",
      });
      suggestedMarkerCleanupRef.current = () => {
        marker.setMap(null);
      };
    }
  }, [loadState, suggestedStop]);

  // Clean up markers and polyline on unmount
  useEffect(() => {
    return () => {
      markerCleanupRef.current.forEach((fn) => fn());
      suggestedMarkerCleanupRef.current?.();
      polylineRef.current?.setMap(null);
    };
  }, []);

  // ---- Render ----

  // Degrade gracefully: no map section shown if the API is unavailable
  if (loadState === "error") {
    return null;
  }

  const showMap = loadState === "ready" && samples.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
      <div className="relative h-40 sm:h-44">
        {/* Map canvas — hidden behind placeholder until GPS data is ready */}
        <div
          ref={containerRef}
          className={`h-full w-full transition-opacity duration-500 ${showMap ? "opacity-100" : "opacity-0"}`}
        />

        {/* Placeholder: loading spinner or "waiting for GPS" */}
        {!showMap ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-muted/20">
            {loadState === "loading" ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            ) : (
              // API ready but no samples yet
              <div className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-primary/30" />
                <span className="relative h-3 w-3 rounded-full bg-primary/60" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {loadState === "loading" ? "Loading map…" : "Locating your route…"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
