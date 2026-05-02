import type { TrackingSampleRecord } from "./mobile-tracking/types";
import type { MobileTripSession } from "./trip-workflow";

const earthRadiusMeters = 6371000;
const metersPerKilometer = 1000;
const maxUsableAccuracyMeters = 50;
const minimumMovingSpeedKmh = 3;
const minimumSegmentMeters = 5;
const maximumAccuracyAdjustedSegmentMeters = 20;
const accuracyNoiseMultiplier = 0.5;

type SamplePoint = Pick<TrackingSampleRecord, "latitude" | "longitude" | "sequence"> & Partial<Pick<TrackingSampleRecord, "accuracyMeters" | "timestampMs" | "recordedAt">>;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getSampleTimeMs(sample: SamplePoint) {
  if (typeof sample.timestampMs === "number" && Number.isFinite(sample.timestampMs)) {
    return sample.timestampMs;
  }

  if (sample.recordedAt) {
    const parsedTime = new Date(sample.recordedAt).getTime();
    return Number.isFinite(parsedTime) ? parsedTime : null;
  }

  return null;
}

function isValidCoordinateSample(sample: SamplePoint) {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

function hasUsableAccuracy(sample: SamplePoint) {
  return sample.accuracyMeters === null || sample.accuracyMeters === undefined || (Number.isFinite(sample.accuracyMeters) && sample.accuracyMeters <= maxUsableAccuracyMeters);
}

export function getDistanceMeters(start: SamplePoint, end: SamplePoint) {
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

export function getSegmentSpeedKmh(start: SamplePoint, end: SamplePoint) {
  const startTimeMs = getSampleTimeMs(start);
  const endTimeMs = getSampleTimeMs(end);

  if (startTimeMs === null || endTimeMs === null || endTimeMs <= startTimeMs) {
    return undefined;
  }

  const elapsedHours = (endTimeMs - startTimeMs) / (1000 * 60 * 60);
  return getDistanceMeters(start, end) / metersPerKilometer / elapsedHours;
}

function getAccuracyAdjustedMinimumSegmentMeters(start: SamplePoint, end: SamplePoint) {
  const accuracies = [start.accuracyMeters, end.accuracyMeters].filter(
    (accuracy): accuracy is number => typeof accuracy === "number" && Number.isFinite(accuracy),
  );

  if (accuracies.length === 0) {
    return minimumSegmentMeters;
  }

  const averageAccuracy = accuracies.reduce((total, accuracy) => total + accuracy, 0) / accuracies.length;
  return Math.min(maximumAccuracyAdjustedSegmentMeters, Math.max(minimumSegmentMeters, averageAccuracy * accuracyNoiseMultiplier));
}

export function shouldAccumulateSegment(start: SamplePoint, end: SamplePoint) {
  if (!isValidCoordinateSample(start) || !isValidCoordinateSample(end) || !hasUsableAccuracy(start) || !hasUsableAccuracy(end)) {
    return false;
  }

  const distanceMeters = getDistanceMeters(start, end);
  if (distanceMeters < getAccuracyAdjustedMinimumSegmentMeters(start, end)) {
    return false;
  }

  const speedKmh = getSegmentSpeedKmh(start, end);
  if (typeof speedKmh === "number" && Number.isFinite(speedKmh) && speedKmh < minimumMovingSpeedKmh) {
    return false;
  }

  return true;
}

export function isValidDistanceKm(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function roundDistanceKm(distanceKm: number) {
  return Math.round((distanceKm + Number.EPSILON) * 1000) / 1000;
}

export function calculateSampleDistanceKm(samples: SamplePoint[]) {
  const sortedSamples = [...samples]
    .filter((sample) => isValidCoordinateSample(sample) && hasUsableAccuracy(sample))
    .sort((left, right) => left.sequence - right.sequence);

  if (sortedSamples.length < 2) {
    return 0;
  }

  let distanceMeters = 0;
  for (let index = 1; index < sortedSamples.length; index += 1) {
    const previousSample = sortedSamples[index - 1];
    const currentSample = sortedSamples[index];
    if (shouldAccumulateSegment(previousSample, currentSample)) {
      distanceMeters += getDistanceMeters(previousSample, currentSample);
    }
  }

  return distanceMeters / metersPerKilometer;
}

export function getCompletedTripDistanceKilometers(trip: MobileTripSession, sampleDistanceKm?: number) {
  if (isValidDistanceKm(trip.backendDistanceKm)) {
    return roundDistanceKm(trip.backendDistanceKm);
  }

  if (isValidDistanceKm(sampleDistanceKm) && sampleDistanceKm > 0) {
    return roundDistanceKm(sampleDistanceKm);
  }

  if (typeof trip.distanceMeters === "number" && Number.isFinite(trip.distanceMeters) && trip.distanceMeters >= 0) {
    return roundDistanceKm(trip.distanceMeters / metersPerKilometer);
  }

  return undefined;
}
