import { describe, expect, it } from "vitest";
import {
  formatDashboardDuration,
  getDashboardStatusLabel,
  getHomeDashboardDriveStateLabel,
  getHomeDashboardStatusLabel,
  hasReliableMovementForTripStartSuggestion,
  shouldKeepHomeDashboardAwake,
  shouldShowTripStartSuggestion,
} from "./trip-dashboard";
import type { TrackingDiagnostics } from "./mobile-tracking/types";

function createDiagnostics(overrides: Partial<TrackingDiagnostics> = {}): TrackingDiagnostics {
  return {
    platform: "android",
    runtimeMode: "development-build",
    supportsBackgroundTracking: true,
    availability: { status: "available" },
    healthState: "active-healthy",
    sampleArrivalState: "fresh",
    operationState: "idle",
    backgroundCallbackState: "recent-callback",
    backgroundDiagnosis: "none",
    backgroundDiagnosisMessage: "",
    likelyBackgroundRestricted: false,
    active: true,
    expectedServiceState: "running",
    actualServiceState: "running",
    stateMatchesExpectation: true,
    lifecycleOwner: "expo-location-background-task",
    continuityMode: "continuous-background",
    nativeBufferedCount: 0,
    importedSampleCount: 2,
    foregroundWatchActive: true,
    foregroundSampleCount: 2,
    backgroundSampleCount: 0,
    lastForegroundSampleAt: "2026-04-12T00:00:00.000Z",
    lastBackgroundSampleAt: null,
    backgroundTaskDefined: true,
    backgroundTaskStarted: true,
    lastBackgroundTaskCallbackAt: null,
    backgroundTaskCallbackCount: 0,
    lastBackgroundTaskError: null,
    lastBackgroundTaskErrorAt: null,
    lastDrainCount: 0,
    lastImportCount: 0,
    staleThresholdSeconds: 60,
    staleServiceDetected: false,
    sessionMismatch: false,
    updatedAt: "2026-04-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("trip dashboard helpers", () => {
  it("formats dashboard duration as compact hours and minutes", () => {
    expect(formatDashboardDuration(84)).toBe("01:24");
    expect(formatDashboardDuration(4)).toBe("00:04");
    expect(formatDashboardDuration(undefined)).toBe("--:--");
  });

  it("derives concise dashboard status labels", () => {
    expect(getDashboardStatusLabel(false, null)).toBe("READY");
    expect(getDashboardStatusLabel(true, createDiagnostics())).toBe("TRACKING");
    expect(getDashboardStatusLabel(true, createDiagnostics({ availability: { status: "unavailable", reason: "location-services-disabled" } }))).toBe("GPS OFF");
    expect(getDashboardStatusLabel(true, createDiagnostics({ sampleArrivalState: "stale" }))).toBe("NO SIGNAL");
  });

  it("keeps tracking status simple when live GPS confidence is acceptable", () => {
    expect(getHomeDashboardStatusLabel({
      active: true,
      trackingDiagnostics: createDiagnostics(),
      liveMotionStatus: "available",
      accuracyMeters: 8,
    })).toBe("TRACKING");
  });

  it("adds weak GPS context while tracking when live GPS confidence is poor", () => {
    expect(getHomeDashboardStatusLabel({
      active: true,
      trackingDiagnostics: createDiagnostics(),
      liveMotionStatus: "available",
      accuracyMeters: 60,
    })).toBe("TRACKING · WEAK GPS");
  });

  it("keeps ready status simple when live GPS confidence is acceptable", () => {
    expect(getHomeDashboardStatusLabel({
      active: false,
      liveMotionStatus: "available",
      accuracyMeters: 8,
    })).toBe("READY");
  });

  it("adds weak GPS context while ready when live GPS confidence is poor", () => {
    expect(getHomeDashboardStatusLabel({
      active: false,
      liveMotionStatus: "available",
      accuracyMeters: 60,
    })).toBe("READY · WEAK GPS");
  });

  it("shows no signal when live motion is unavailable", () => {
    expect(getHomeDashboardStatusLabel({
      active: false,
      liveMotionStatus: "noSignal",
      accuracyMeters: undefined,
    })).toBe("NO SIGNAL");
  });

  it("derives no-signal drive state without live motion", () => {
    expect(getHomeDashboardDriveStateLabel({
      liveMotionStatus: "noSignal",
      speedKmh: undefined,
    })).toBe("NO SIGNAL");
  });

  it("derives stopped drive state from confidence-gated stationary speed", () => {
    expect(getHomeDashboardDriveStateLabel({
      liveMotionStatus: "available",
      speedKmh: 0,
    })).toBe("STOPPED");
  });

  it("derives moving drive state from reliable speed above the movement threshold", () => {
    expect(getHomeDashboardDriveStateLabel({
      liveMotionStatus: "available",
      speedKmh: 12,
    })).toBe("MOVING");
  });

  it("does not infer movement from weak GPS when speed has been suppressed", () => {
    expect(getHomeDashboardDriveStateLabel({
      liveMotionStatus: "available",
      speedKmh: 0,
    })).toBe("STOPPED");
  });

  it("uses the same drive state rules for active trip and ready dashboard modes", () => {
    const activeTripDriveState = getHomeDashboardDriveStateLabel({
      liveMotionStatus: "available",
      speedKmh: 4,
    });
    const readyDriveState = getHomeDashboardDriveStateLabel({
      liveMotionStatus: "available",
      speedKmh: 4,
    });

    expect(activeTripDriveState).toBe("MOVING");
    expect(readyDriveState).toBe("MOVING");
  });

  it("suggests starting a trip after sustained reliable movement without an active trip", () => {
    expect(shouldShowTripStartSuggestion({
      active: false,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 8,
      reliableMovementSince: "2026-04-12T00:00:00.000Z",
      dismissed: false,
      now: new Date("2026-04-12T00:00:16.000Z"),
    })).toBe(true);
  });

  it("does not suggest starting a trip before movement is sustained", () => {
    expect(shouldShowTripStartSuggestion({
      active: false,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 8,
      reliableMovementSince: "2026-04-12T00:00:00.000Z",
      dismissed: false,
      now: new Date("2026-04-12T00:00:09.000Z"),
    })).toBe(false);
  });

  it("does not suggest starting a trip from weak GPS movement", () => {
    expect(hasReliableMovementForTripStartSuggestion({
      active: false,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 60,
    })).toBe(false);
    expect(shouldShowTripStartSuggestion({
      active: false,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 60,
      reliableMovementSince: "2026-04-12T00:00:00.000Z",
      dismissed: false,
      now: new Date("2026-04-12T00:00:20.000Z"),
    })).toBe(false);
  });

  it("does not suggest starting a trip while a trip is already active", () => {
    expect(shouldShowTripStartSuggestion({
      active: true,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 8,
      reliableMovementSince: "2026-04-12T00:00:00.000Z",
      dismissed: false,
      now: new Date("2026-04-12T00:00:20.000Z"),
    })).toBe(false);
  });

  it("hides the start-trip suggestion when stopped or no signal", () => {
    expect(shouldShowTripStartSuggestion({
      active: false,
      liveMotionStatus: "available",
      driveState: "STOPPED",
      accuracyMeters: 8,
      reliableMovementSince: "2026-04-12T00:00:00.000Z",
      dismissed: false,
      now: new Date("2026-04-12T00:00:20.000Z"),
    })).toBe(false);
    expect(shouldShowTripStartSuggestion({
      active: false,
      liveMotionStatus: "noSignal",
      driveState: "NO SIGNAL",
      accuracyMeters: undefined,
      reliableMovementSince: undefined,
      dismissed: false,
      now: new Date("2026-04-12T00:00:20.000Z"),
    })).toBe(false);
  });

  it("suppresses immediate start-trip suggestion reappearance after dismissal", () => {
    expect(shouldShowTripStartSuggestion({
      active: false,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 8,
      reliableMovementSince: "2026-04-12T00:00:00.000Z",
      dismissed: true,
      now: new Date("2026-04-12T00:00:20.000Z"),
    })).toBe(false);
  });

  it("keeps the Home dashboard awake for reliable moving state", () => {
    expect(shouldKeepHomeDashboardAwake({
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 8,
      now: new Date("2026-04-12T00:00:00.000Z"),
    })).toBe(true);
  });

  it("respects disabled Home dashboard keep-awake preference", () => {
    expect(shouldKeepHomeDashboardAwake({
      enabled: false,
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 8,
      now: new Date("2026-04-12T00:00:00.000Z"),
    })).toBe(false);
  });

  it("does not keep the Home dashboard awake for weak GPS or no signal", () => {
    expect(shouldKeepHomeDashboardAwake({
      liveMotionStatus: "available",
      driveState: "MOVING",
      accuracyMeters: 60,
      now: new Date("2026-04-12T00:00:00.000Z"),
    })).toBe(false);
    expect(shouldKeepHomeDashboardAwake({
      liveMotionStatus: "noSignal",
      driveState: "MOVING",
      accuracyMeters: 8,
      now: new Date("2026-04-12T00:00:00.000Z"),
    })).toBe(false);
  });

  it("keeps the Home dashboard awake briefly after reliable movement Gigs", () => {
    expect(shouldKeepHomeDashboardAwake({
      liveMotionStatus: "available",
      driveState: "STOPPED",
      accuracyMeters: 8,
      lastReliableMovementAt: "2026-04-12T00:00:00.000Z",
      now: new Date("2026-04-12T00:00:30.000Z"),
    })).toBe(true);
  });

  it("keeps the dashboard awake while an active trip is stopped with reliable GPS", () => {
    expect(shouldKeepHomeDashboardAwake({
      active: true,
      liveMotionStatus: "available",
      driveState: "STOPPED",
      accuracyMeters: 8,
      now: new Date("2026-04-12T00:00:00.000Z"),
    })).toBe(true);
  });

  it("lets normal screen sleep resume after the stopped grace period expires", () => {
    expect(shouldKeepHomeDashboardAwake({
      liveMotionStatus: "available",
      driveState: "STOPPED",
      accuracyMeters: 8,
      lastReliableMovementAt: "2026-04-12T00:00:00.000Z",
      now: new Date("2026-04-12T00:00:46.000Z"),
    })).toBe(false);
  });
});
