import type { TrackingSampleRecord } from "./mobile-tracking/types";

export type TripRouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type TripRouteMarkers = {
  start?: TripRouteCoordinate;
  finish?: TripRouteCoordinate;
};

export type TripRouteRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type RouteSample = Pick<TrackingSampleRecord, "latitude" | "longitude" | "sequence">;

const minimumRouteDelta = 0.01;
const routePaddingFactor = 1.5;

function isValidRouteSample(sample: RouteSample) {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

export function getTripRouteCoordinates(samples: RouteSample[]): TripRouteCoordinate[] {
  return [...samples]
    .filter(isValidRouteSample)
    .sort((left, right) => left.sequence - right.sequence)
    .map((sample) => ({
      latitude: sample.latitude,
      longitude: sample.longitude,
    }));
}

export function hasTripRouteMap(coordinates: TripRouteCoordinate[]) {
  return coordinates.length >= 2;
}

export function getTripRouteMarkers(coordinates: TripRouteCoordinate[]): TripRouteMarkers {
  return {
    start: coordinates[0],
    finish: coordinates.at(-1),
  };
}

export function getTripRouteInitialRegion(coordinates: TripRouteCoordinate[]): TripRouteRegion | undefined {
  if (coordinates.length === 0) {
    return undefined;
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const latitudeDelta = Math.max((maximumLatitude - minimumLatitude) * routePaddingFactor, minimumRouteDelta);
  const longitudeDelta = Math.max((maximumLongitude - minimumLongitude) * routePaddingFactor, minimumRouteDelta);

  return {
    latitude: (minimumLatitude + maximumLatitude) / 2,
    longitude: (minimumLongitude + maximumLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}
