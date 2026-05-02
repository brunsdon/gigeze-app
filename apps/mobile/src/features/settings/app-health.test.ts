import { describe, expect, it } from "vitest";
import type { TrackingDiagnostics } from "../trips/mobile-tracking/types";
import type { TripSyncDiagnostics } from "../trips/trip-workflow";
import {
  getLocationServicesHealthStatus,
  getPermissionHealthStatus,
  getSyncHealthStatus,
  getTrackingHealthStatus,
} from "./app-health";

function createTrackingDiagnostics(overrides: Partial<TrackingDiagnostics> = {}): TrackingDiagnostics {
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
    backgroundDiagnosisMessage: "none",
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
    foregroundSampleCount: 1,
    backgroundSampleCount: 1,
    lastForegroundSampleAt: null,
    lastBackgroundSampleAt: null,
    backgroundTaskDefined: true,
    backgroundTaskStarted: true,
    lastBackgroundTaskCallbackAt: null,
    backgroundTaskCallbackCount: 1,
    lastBackgroundTaskError: null,
    lastBackgroundTaskErrorAt: null,
    lastDrainCount: 0,
    lastImportCount: 0,
    staleThresholdSeconds: 60,
    foregroundPermission: "granted",
    backgroundPermission: "granted",
    locationServicesEnabled: true,
    staleServiceDetected: false,
    sessionMismatch: false,
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

function createSyncDiagnostics(overrides: Partial<TripSyncDiagnostics> = {}): TripSyncDiagnostics {
  return {
    pendingSyncCount: 0,
    syncingCount: 0,
    syncedCount: 1,
    syncFailedCount: 0,
    localOnlyCount: 0,
    pendingDeleteCount: 0,
    ...overrides,
  };
}

describe("app health summary", () => {
  it("maps healthy tracking, sync, permissions, and location services to good states", () => {
    const tracking = createTrackingDiagnostics();

    expect(getTrackingHealthStatus(tracking)).toMatchObject({ label: "Good", tone: "good" });
    expect(getSyncHealthStatus(createSyncDiagnostics())).toMatchObject({ label: "Good", tone: "good" });
    expect(getPermissionHealthStatus(tracking)).toMatchObject({ label: "Granted", tone: "good" });
    expect(getLocationServicesHealthStatus(tracking)).toMatchObject({ label: "Enabled", tone: "good" });
  });

  it("maps degraded tracking and pending sync to warning states", () => {
    expect(getTrackingHealthStatus(createTrackingDiagnostics({
      healthState: "active-stale",
      sampleArrivalState: "stale",
    }))).toMatchObject({ label: "Watch", tone: "warning" });

    expect(getSyncHealthStatus(createSyncDiagnostics({ pendingSyncCount: 1 }))).toMatchObject({
      label: "Pending",
      tone: "warning",
    });
  });

  it("maps blocked tracking, failed sync, missing permissions, and disabled location to error states", () => {
    const tracking = createTrackingDiagnostics({
      availability: { status: "unavailable", reason: "permission-denied" },
      foregroundPermission: "denied",
      locationServicesEnabled: false,
    });

    expect(getTrackingHealthStatus(tracking)).toMatchObject({ label: "Blocked", tone: "error" });
    expect(getSyncHealthStatus(createSyncDiagnostics({
      syncFailedCount: 1,
      lastSyncError: "Trip sync failed",
    }))).toMatchObject({ label: "Needs attention", tone: "error" });
    expect(getPermissionHealthStatus(tracking)).toMatchObject({ label: "Missing", tone: "error" });
    expect(getLocationServicesHealthStatus(tracking)).toMatchObject({ label: "Disabled", tone: "error" });
  });

  it("uses not-available states when diagnostics have not loaded", () => {
    expect(getTrackingHealthStatus(null)).toMatchObject({ label: "Not available", tone: "unknown" });
    expect(getPermissionHealthStatus(null)).toMatchObject({ label: "Not available", tone: "unknown" });
    expect(getLocationServicesHealthStatus(null)).toMatchObject({ label: "Not available", tone: "unknown" });
  });
});
