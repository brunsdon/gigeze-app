import { getSegmentSpeedKmh, shouldAccumulateSegment } from "./trip-distance";
import type { TrackingSampleRecord } from "./mobile-tracking/types";

const metersPerSecondToKilometersPerHour = 3.6;
const stationarySpeedThresholdKmh = 3;
const maxProviderSpeedAccuracyMeters = 20;
const maxComputedSpeedAccuracyMeters = 30;

type SpeedSample = Pick<TrackingSampleRecord, "latitude" | "longitude" | "sequence" | "timestampMs" | "recordedAt"> &
  Partial<Pick<TrackingSampleRecord, "accuracyMeters">> & {
    speedMetersPerSecond?: number | null;
  };

function getSampleTimeMs(sample: SpeedSample) {
  if (Number.isFinite(sample.timestampMs)) {
    return sample.timestampMs;
  }

  const parsedTime = new Date(sample.recordedAt).getTime();
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

function isValidSpeedSample(sample: SpeedSample) {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180 &&
    getSampleTimeMs(sample) !== null
  );
}

export function getCurrentSpeedKmh(samples: SpeedSample[]) {
  const latestSamples = [...samples]
    .filter(isValidSpeedSample)
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-2);

  if (latestSamples.length < 2) {
    return undefined;
  }

  const [previousSample, currentSample] = latestSamples;
  const providerSpeedKmh = getProviderSpeedKmh(currentSample);
  if (providerSpeedKmh !== undefined) {
    return providerSpeedKmh;
  }

  const previousTimeMs = getSampleTimeMs(previousSample);
  const currentTimeMs = getSampleTimeMs(currentSample);

  if (previousTimeMs === null || currentTimeMs === null || currentTimeMs <= previousTimeMs) {
    return undefined;
  }

  if (!hasReliableComputedSpeedAccuracy(previousSample) || !hasReliableComputedSpeedAccuracy(currentSample)) {
    return 0;
  }

  if (!shouldAccumulateSegment(previousSample, currentSample)) {
    return 0;
  }

  return getSegmentSpeedKmh(previousSample, currentSample);
}

function hasReliableProviderSpeedAccuracy(sample: Pick<SpeedSample, "accuracyMeters">) {
  return typeof sample.accuracyMeters === "number" && Number.isFinite(sample.accuracyMeters) && sample.accuracyMeters <= maxProviderSpeedAccuracyMeters;
}

export function isGpsAccuracyWeakForSpeed(accuracyMeters: number | null | undefined) {
  return typeof accuracyMeters === "number" && Number.isFinite(accuracyMeters) && accuracyMeters > maxProviderSpeedAccuracyMeters;
}

export function isReliableMovingSpeed(speedKmh: number | undefined) {
  return typeof speedKmh === "number" && Number.isFinite(speedKmh) && speedKmh >= stationarySpeedThresholdKmh;
}

function hasReliableComputedSpeedAccuracy(sample: Pick<SpeedSample, "accuracyMeters">) {
  return typeof sample.accuracyMeters === "number" && Number.isFinite(sample.accuracyMeters) && sample.accuracyMeters <= maxComputedSpeedAccuracyMeters;
}

export function shouldUseProviderSpeed(sample: Pick<SpeedSample, "accuracyMeters" | "speedMetersPerSecond">) {
  const speedMetersPerSecond = sample.speedMetersPerSecond;
  return typeof speedMetersPerSecond === "number" && Number.isFinite(speedMetersPerSecond) && speedMetersPerSecond >= 0 && hasReliableProviderSpeedAccuracy(sample);
}

export function getProviderSpeedKmh(sample: Pick<SpeedSample, "accuracyMeters" | "speedMetersPerSecond">) {
  if (!shouldUseProviderSpeed(sample)) {
    return undefined;
  }

  const speedMetersPerSecond = sample.speedMetersPerSecond;
  if (typeof speedMetersPerSecond !== "number") {
    return undefined;
  }

  const speedKmh = speedMetersPerSecond * metersPerSecondToKilometersPerHour;
  return speedKmh < stationarySpeedThresholdKmh ? 0 : speedKmh;
}

export function formatSpeedKmh(speedKmh: number | undefined) {
  if (typeof speedKmh !== "number" || !Number.isFinite(speedKmh) || speedKmh < 0) {
    return "--";
  }

  return String(Math.round(speedKmh));
}
