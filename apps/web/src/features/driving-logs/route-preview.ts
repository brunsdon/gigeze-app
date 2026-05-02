export type DrivingLogRouteSample = {
  latitude: number;
  longitude: number;
  recordedAt?: string;
};

export type DrivingLogRouteCoordinate = {
  lat: number;
  lng: number;
};

export function isValidRouteCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getDrivingLogRouteCoordinates(samples: DrivingLogRouteSample[], maxPoints = 180): DrivingLogRouteCoordinate[] {
  const validCoordinates = samples.flatMap((sample) =>
    isValidRouteCoordinate(sample.latitude, sample.longitude)
      ? [{ lat: sample.latitude, lng: sample.longitude }]
      : [],
  );

  if (validCoordinates.length <= maxPoints) {
    return validCoordinates;
  }

  const step = Math.max(1, Math.ceil(validCoordinates.length / maxPoints));
  const reduced = validCoordinates.filter((_, index) => index % step === 0);
  const last = validCoordinates[validCoordinates.length - 1];

  if (reduced.at(-1) !== last) {
    reduced.push(last);
  }

  return reduced;
}

export function getRouteEndpoint(logId: string) {
  return `/api/logs/driving/${encodeURIComponent(logId)}/route`;
}

export function getNextExpandedLogId(currentLogId: string | null, selectedLogId: string) {
  return currentLogId === selectedLogId ? null : selectedLogId;
}
