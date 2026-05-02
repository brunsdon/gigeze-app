export type FormatDistanceKmOptions = {
  tripType?: "walking" | "ride" | "driving";
};

function isFiniteDistance(distanceKm: number | null | undefined): distanceKm is number {
  return typeof distanceKm === "number" && Number.isFinite(distanceKm);
}

function roundToDecimal(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatDistanceKm(distanceKm: number | null | undefined, options: FormatDistanceKmOptions = {}) {
  if (!isFiniteDistance(distanceKm)) {
    return "—";
  }

  if (distanceKm <= 0) {
    return "0 km";
  }

  const alwaysShowOneDecimalUnderTen = options.tripType === "walking" || options.tripType === "ride";

  if (distanceKm < 1) {
    const roundedDistance = Math.max(0.1, roundToDecimal(distanceKm, 1));
    return `${roundedDistance.toFixed(1)} km`;
  }

  if (distanceKm < 10) {
    const roundedDistance = roundToDecimal(distanceKm, 1);

    if (roundedDistance >= 10) {
      return "10 km";
    }

    if (alwaysShowOneDecimalUnderTen) {
      return `${roundedDistance.toFixed(1)} km`;
    }

    return Number.isInteger(roundedDistance) ? `${roundedDistance} km` : `${roundedDistance.toFixed(1)} km`;
  }

  return `${roundToDecimal(distanceKm, 0)} km`;
}
