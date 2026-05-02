type CoordinateValue = number | string | { toString(): string } | null | undefined;

type DrivingLogPointSource = {
  startLatitude?: CoordinateValue;
  startLongitude?: CoordinateValue;
  endLatitude?: CoordinateValue;
  endLongitude?: CoordinateValue;
  startLocation?: string | null;
  endLocation?: string | null;
  startFormattedAddress?: string | null;
  endFormattedAddress?: string | null;
  startPlaceId?: string | null;
  endPlaceId?: string | null;
};

function toCoordinateNumber(value: CoordinateValue) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function getDrivingLogStartPoint(log: DrivingLogPointSource) {
  const latitude = toCoordinateNumber(log.startLatitude);
  const longitude = toCoordinateNumber(log.startLongitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    label: log.startFormattedAddress || log.startLocation || "",
    placeId: log.startPlaceId || null,
  };
}

export function getDrivingLogEndPoint(log: DrivingLogPointSource) {
  const latitude = toCoordinateNumber(log.endLatitude);
  const longitude = toCoordinateNumber(log.endLongitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    label: log.endFormattedAddress || log.endLocation || "",
    placeId: log.endPlaceId || null,
  };
}
