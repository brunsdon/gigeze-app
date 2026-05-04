import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { getMobileConfig } from "../lib/config";
import {
  getTripRouteInitialRegion,
  getTripRouteMarkers,
  hasTripRouteMap,
  type TripRouteCoordinate,
} from "../features/trips/trip-route-map";

type TripRouteHeroProps = {
  routeCoordinates: TripRouteCoordinate[];
  overlayLabel: string;
  overlayValue: string;
  overlayDetail?: string;
  fallbackTitle: string;
  fallbackBody: string;
  mapUnavailableTitle?: string;
  mapUnavailableBody?: string;
  endMarkerLabel?: string;
  endMarkerTone?: "finish" | "current";
  followRouteUpdates?: boolean;
  reserveOverlaySpace?: boolean;
  overlayPlacement?: "floating" | "inline";
};

const routeMapEdgePadding = {
  top: 54,
  right: 54,
  bottom: 54,
  left: 54,
};

const routeMapOverlayEdgePadding = {
  top: 108,
  right: 150,
  bottom: 60,
  left: 116,
};

export function TripRouteHero({
  routeCoordinates,
  overlayLabel,
  overlayValue,
  overlayDetail,
  fallbackTitle,
  fallbackBody,
  mapUnavailableTitle,
  mapUnavailableBody,
  endMarkerLabel = "B",
  endMarkerTone = "finish",
  followRouteUpdates = false,
  reserveOverlaySpace = false,
  overlayPlacement = "floating",
}: TripRouteHeroProps) {
  const mapRef = useRef<MapView | null>(null);
  const fittedRouteKeyRef = useRef<string | null>(null);
  const hasRoute = hasTripRouteMap(routeCoordinates);
  const canRenderNativeMap = Platform.OS !== "android" || getMobileConfig().googleMapsApiKeyConfigured;
  const routeMarkers = useMemo(() => getTripRouteMarkers(routeCoordinates), [routeCoordinates]);
  const initialRegion = useMemo(() => getTripRouteInitialRegion(routeCoordinates), [routeCoordinates]);
  const routeKey = `${routeCoordinates.length}:${routeMarkers.start?.latitude ?? ""}:${routeMarkers.start?.longitude ?? ""}:${routeMarkers.finish?.latitude ?? ""}:${routeMarkers.finish?.longitude ?? ""}`;
  const fitRouteToBounds = useCallback(() => {
    if (!hasRoute || fittedRouteKeyRef.current === routeKey) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.fitToCoordinates(routeCoordinates, {
      edgePadding: reserveOverlaySpace ? routeMapOverlayEdgePadding : routeMapEdgePadding,
      animated: false,
    });
    fittedRouteKeyRef.current = routeKey;
  }, [hasRoute, reserveOverlaySpace, routeCoordinates, routeKey]);

  useEffect(() => {
    fittedRouteKeyRef.current = null;
  }, [routeKey]);

  useEffect(() => {
    if (!followRouteUpdates) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fitRouteToBounds();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fitRouteToBounds, followRouteUpdates]);

  const placeholderTitle = hasRoute ? mapUnavailableTitle ?? "Map preview unavailable" : fallbackTitle;
  const placeholderBody = hasRoute
    ? mapUnavailableBody ?? "Map preview is unavailable in this build. Your trip distance and details are still saved."
    : fallbackBody;
  const routeOverlay = (
    <View style={overlayPlacement === "inline" ? styles.routeOverlayInline : styles.routeOverlay}>
      <Text style={styles.routeOverlayLabel}>{overlayLabel}</Text>
      <Text style={styles.routeOverlayValue}>{overlayValue}</Text>
      {overlayDetail ? <Text style={styles.routeOverlayDetail}>{overlayDetail}</Text> : null}
    </View>
  );

  return (
    <View style={styles.routePreview}>
      {overlayPlacement === "inline" ? <View style={styles.routeOverlayInlineRow}>{routeOverlay}</View> : routeOverlay}
      {hasRoute && canRenderNativeMap && initialRegion && routeMarkers.start && routeMarkers.finish ? (
        <MapView
          ref={mapRef}
          initialRegion={initialRegion}
          onLayout={fitRouteToBounds}
          onMapReady={fitRouteToBounds}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          style={styles.routeMap}
          toolbarEnabled={false}
          zoomEnabled={false}
        >
          <Polyline
            coordinates={routeCoordinates}
            lineCap="round"
            lineJoin="round"
            strokeColor="#FF2E63"
            strokeWidth={6}
          />
          <Marker coordinate={routeMarkers.start} zIndex={2}>
            <View style={[styles.routeMarker, styles.routeMarkerStart]}>
              <Text style={styles.routeMarkerText}>A</Text>
            </View>
          </Marker>
          <Marker coordinate={routeMarkers.finish} zIndex={2}>
            <View style={endMarkerTone === "current" ? styles.routeMarkerCurrent : [styles.routeMarker, styles.routeMarkerFinish]}>
              <Text style={styles.routeMarkerText}>{endMarkerLabel}</Text>
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.routePlaceholder}>
          <Text style={styles.routePlaceholderTitle}>{placeholderTitle}</Text>
          <Text style={styles.routePlaceholderBody}>{placeholderBody}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  routePreview: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    borderRadius: 8,
    minHeight: 240,
    overflow: "hidden",
    position: "relative",
  },
  routeMap: {
    minHeight: 240,
  },
  routeMarker: {
    alignItems: "center",
    borderColor: "#FFF7EA",
    borderRadius: 16,
    borderWidth: 2,
    elevation: 4,
    height: 32,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    width: 32,
  },
  routeMarkerStart: {
    backgroundColor: "#FF2E63",
  },
  routeMarkerFinish: {
    backgroundColor: "#FF2E63",
  },
  routeMarkerCurrent: {
    alignItems: "center",
    backgroundColor: "#FF2E63",
    borderColor: "#FFF7EA",
    borderRadius: 16,
    borderWidth: 2,
    elevation: 4,
    height: 32,
    justifyContent: "center",
    minWidth: 32,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    width: 32,
  },
  routeMarkerText: {
    color: "#FFF7EA",
    fontSize: 13,
    fontWeight: "900",
  },
  routeOverlay: {
    backgroundColor: "rgba(8, 7, 10, 0.84)",
    borderRadius: 8,
    padding: 14,
    position: "absolute",
    right: 14,
    top: 14,
    zIndex: 2,
  },
  routeOverlayInlineRow: {
    alignItems: "flex-end",
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    padding: 12,
    paddingBottom: 0,
  },
  routeOverlayInline: {
    backgroundColor: "rgba(8, 7, 10, 0.88)",
    borderRadius: 8,
    minWidth: 126,
    padding: 12,
  },
  routeOverlayLabel: {
    color: "#FFF7EA",
    fontSize: 12,
    fontWeight: "800",
  },
  routeOverlayValue: {
    color: "#FFF7EA",
    fontSize: 24,
    fontWeight: "900",
  },
  routeOverlayDetail: {
    color: "#D8CEDF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  routePlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 240,
    padding: 24,
  },
  routePlaceholderTitle: {
    color: "#FFF7EA",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  routePlaceholderBody: {
    color: "#B8AFC0",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: 6,
    textAlign: "center",
  },
});
