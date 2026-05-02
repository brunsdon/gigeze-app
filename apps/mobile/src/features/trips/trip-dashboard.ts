import type { TrackingDiagnostics } from "./mobile-tracking/types";
import { isGpsAccuracyWeakForSpeed, isReliableMovingSpeed } from "./trip-speed";

type DashboardLiveMotionStatus = "checking" | "available" | "permissionDenied" | "servicesDisabled" | "noSignal" | "error";

type HomeDashboardStatusInput = {
  active: boolean;
  trackingDiagnostics?: TrackingDiagnostics | null;
  liveMotionStatus: DashboardLiveMotionStatus;
  accuracyMeters?: number | null;
};

type HomeDashboardDriveStateInput = {
  liveMotionStatus: DashboardLiveMotionStatus;
  speedKmh?: number;
};

type TripStartSuggestionInput = {
  active: boolean;
  liveMotionStatus: DashboardLiveMotionStatus;
  driveState: string;
  accuracyMeters?: number | null;
  reliableMovementSince?: string;
  dismissed: boolean;
  now?: Date;
};

type HomeDashboardKeepAwakeInput = {
  enabled?: boolean;
  active?: boolean;
  liveMotionStatus: DashboardLiveMotionStatus;
  driveState: string;
  accuracyMeters?: number | null;
  lastReliableMovementAt?: string;
  now?: Date;
};

const tripStartSuggestionSustainSeconds = 15;
export const homeDashboardKeepAwakeGraceMs = 45000;

export function formatDashboardDuration(durationMinutes?: number) {
  if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes < 0) {
    return "--:--";
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = Math.floor(durationMinutes % 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getDashboardStatusLabel(active: boolean, trackingDiagnostics?: TrackingDiagnostics | null) {
  if (!active) {
    return "READY";
  }

  if (trackingDiagnostics?.availability.status === "unavailable") {
    return "GPS OFF";
  }

  if (trackingDiagnostics?.sampleArrivalState === "stale" || trackingDiagnostics?.sampleArrivalState === "waiting-for-first-sample") {
    return "NO SIGNAL";
  }

  return "TRACKING";
}

export function getHomeDashboardStatusLabel({
  active,
  trackingDiagnostics,
  liveMotionStatus,
  accuracyMeters,
}: HomeDashboardStatusInput) {
  const baseStatus = active
    ? getDashboardStatusLabel(true, trackingDiagnostics)
    : liveMotionStatus === "available"
      ? "READY"
      : "NO SIGNAL";

  if (baseStatus !== "TRACKING" && baseStatus !== "READY") {
    return baseStatus;
  }

  if (liveMotionStatus === "available" && isGpsAccuracyWeakForSpeed(accuracyMeters)) {
    return `${baseStatus} · WEAK GPS`;
  }

  return baseStatus;
}

export function getHomeDashboardDriveStateLabel({ liveMotionStatus, speedKmh }: HomeDashboardDriveStateInput) {
  if (liveMotionStatus !== "available") {
    return "NO SIGNAL";
  }

  return isReliableMovingSpeed(speedKmh) ? "MOVING" : "STOPPED";
}

export function hasReliableMovementForTripStartSuggestion({
  active,
  liveMotionStatus,
  driveState,
  accuracyMeters,
}: Pick<TripStartSuggestionInput, "active" | "liveMotionStatus" | "driveState" | "accuracyMeters">) {
  return !active && liveMotionStatus === "available" && driveState === "MOVING" && !isGpsAccuracyWeakForSpeed(accuracyMeters);
}

export function shouldShowTripStartSuggestion({
  active,
  liveMotionStatus,
  driveState,
  accuracyMeters,
  reliableMovementSince,
  dismissed,
  now = new Date(),
}: TripStartSuggestionInput) {
  if (
    dismissed ||
    !hasReliableMovementForTripStartSuggestion({
      active,
      liveMotionStatus,
      driveState,
      accuracyMeters,
    }) ||
    !reliableMovementSince
  ) {
    return false;
  }

  const movingSinceMs = new Date(reliableMovementSince).getTime();
  if (!Number.isFinite(movingSinceMs)) {
    return false;
  }

  const sustainedSeconds = Math.floor((now.getTime() - movingSinceMs) / 1000);
  return sustainedSeconds >= tripStartSuggestionSustainSeconds;
}

export function hasReliableHomeDashboardMovement({
  liveMotionStatus,
  driveState,
  accuracyMeters,
}: Pick<HomeDashboardKeepAwakeInput, "liveMotionStatus" | "driveState" | "accuracyMeters">) {
  return liveMotionStatus === "available" && driveState === "MOVING" && !isGpsAccuracyWeakForSpeed(accuracyMeters);
}

export function shouldKeepHomeDashboardAwake({
  enabled = true,
  active = false,
  liveMotionStatus,
  driveState,
  accuracyMeters,
  lastReliableMovementAt,
  now = new Date(),
}: HomeDashboardKeepAwakeInput) {
  if (!enabled) {
    return false;
  }

  if (liveMotionStatus !== "available" || isGpsAccuracyWeakForSpeed(accuracyMeters)) {
    return false;
  }

  if (active) {
    return true;
  }

  if (driveState === "MOVING") {
    return true;
  }

  if (driveState !== "STOPPED" || !lastReliableMovementAt) {
    return false;
  }

  const lastReliableMovementAtMs = new Date(lastReliableMovementAt).getTime();
  if (!Number.isFinite(lastReliableMovementAtMs)) {
    return false;
  }

  return now.getTime() - lastReliableMovementAtMs <= homeDashboardKeepAwakeGraceMs;
}
