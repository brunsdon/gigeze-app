export interface MapMarker {
  id: string;
  label: string;
  lat: number;
  lng: number;
  orderIndex?: number;
  isCurrent?: boolean;
  description?: string | null;
  journeyId?: string;
  journeyTitle?: string;
  href?: string;
}

export interface MapRoutePoint {
  id: string;
  lat: number;
  lng: number;
  orderIndex: number;
  label?: string;
}

export interface JourneyMapData {
  journeyId: string;
  journeyTitle: string;
  journeySlug?: string;
  markers: MapMarker[];
  routePoints: MapRoutePoint[];
}
