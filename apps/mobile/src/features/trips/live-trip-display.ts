import type { TrackingSampleRecord } from "./mobile-tracking/types";
import type { TripCoordinate } from "./trip-coordinates";

export type LiveTripLocationPoint = {
  coordinate: TripCoordinate;
  recordedAt: string;
};

type CoordinateSample = Pick<TrackingSampleRecord, "latitude" | "longitude" | "recordedAt" | "sequence">;

function isValidCoordinateSample(sample: CoordinateSample) {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

export function getLiveTripLocationPoints(samples: CoordinateSample[]) {
  const validSamples = [...samples]
    .filter(isValidCoordinateSample)
    .sort((left, right) => left.sequence - right.sequence);

  const firstSample = validSamples[0];
  const lastSample = validSamples.at(-1);

  return {
    start: firstSample
      ? {
          coordinate: {
            latitude: firstSample.latitude,
            longitude: firstSample.longitude,
          },
          recordedAt: firstSample.recordedAt,
        }
      : undefined,
    current: lastSample
      ? {
          coordinate: {
            latitude: lastSample.latitude,
            longitude: lastSample.longitude,
          },
          recordedAt: lastSample.recordedAt,
        }
      : undefined,
  };
}
