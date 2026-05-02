import { getCurrentSpeedKmh } from "./trip-speed";

export type LiveSpeedSample = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  timestampMs: number;
  recordedAt: string;
  sequence: number;
};

export function getLiveMotionSpeedKmh(samples: LiveSpeedSample[]) {
  return getCurrentSpeedKmh(samples);
}

export type GpsSignalQuality = "Excellent" | "Good" | "Fair" | "Poor";
export type GpsFreshness = "Live" | "Recent" | "Stale";

const liveFreshnessSeconds = 3;
const recentFreshnessSeconds = 10;

export function getGpsSignalQuality(accuracyMeters: number | null | undefined): GpsSignalQuality | undefined {
  if (typeof accuracyMeters !== "number" || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return undefined;
  }

  if (accuracyMeters <= 5) {
    return "Excellent";
  }

  if (accuracyMeters <= 10) {
    return "Good";
  }

  if (accuracyMeters <= 20) {
    return "Fair";
  }

  return "Poor";
}

export function formatGpsAccuracy(accuracyMeters: number | null | undefined) {
  if (typeof accuracyMeters !== "number" || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return "GPS unavailable";
  }

  return `GPS ±${Math.round(accuracyMeters)}m`;
}

export function formatGpsSignalSummary(accuracyMeters: number | null | undefined) {
  const signalQuality = getGpsSignalQuality(accuracyMeters);
  if (!signalQuality) {
    return "GPS unavailable";
  }

  return `${formatGpsAccuracy(accuracyMeters)} · ${signalQuality}`;
}

export function getGpsFreshness(locationUpdatedAt: string | undefined, now = new Date()): GpsFreshness | undefined {
  if (!locationUpdatedAt) {
    return undefined;
  }

  const updatedAtMs = new Date(locationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) {
    return undefined;
  }

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - updatedAtMs) / 1000));
  if (ageSeconds <= liveFreshnessSeconds) {
    return "Live";
  }

  if (ageSeconds <= recentFreshnessSeconds) {
    return "Recent";
  }

  return "Stale";
}

export function formatGpsDiagnosticLine(
  accuracyMeters: number | null | undefined,
  locationUpdatedAt: string | undefined,
  now = new Date(),
) {
  const signalQuality = getGpsSignalQuality(accuracyMeters);
  const freshness = getGpsFreshness(locationUpdatedAt, now);

  if (!signalQuality || !freshness) {
    return "GPS unavailable";
  }

  return `${formatGpsAccuracy(accuracyMeters)} · ${signalQuality} · ${freshness}`;
}
