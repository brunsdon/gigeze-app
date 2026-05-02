import type { TrackingSampleRecord } from "./mobile-tracking/types";

export type TripCoordinate = {
  latitude: number;
  longitude: number;
};

export type TripCoordinateSummary = {
  start?: TripCoordinate;
  current?: TripCoordinate;
  finish?: TripCoordinate;
};

type CoordinateSample = Pick<TrackingSampleRecord, "latitude" | "longitude" | "sequence">;

function isValidCoordinateSample(sample: CoordinateSample): sample is CoordinateSample {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

function getSortedValidSamples(samples: CoordinateSample[]) {
  return [...samples].filter(isValidCoordinateSample).sort((left, right) => left.sequence - right.sequence);
}

export function getTripCoordinateSummary(samples: CoordinateSample[]): TripCoordinateSummary {
  const validSamples = getSortedValidSamples(samples);
  const firstSample = validSamples[0];
  const lastSample = validSamples.at(-1);

  return {
    start: firstSample ? { latitude: firstSample.latitude, longitude: firstSample.longitude } : undefined,
    current: lastSample ? { latitude: lastSample.latitude, longitude: lastSample.longitude } : undefined,
    finish: lastSample ? { latitude: lastSample.latitude, longitude: lastSample.longitude } : undefined,
  };
}

export function formatTripCoordinate(coordinate: TripCoordinate | undefined) {
  if (!coordinate) {
    return "Not available";
  }

  return `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
}
