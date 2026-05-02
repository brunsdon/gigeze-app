import type { TrackingDiagnostics } from "../trips/mobile-tracking/types";
import type { TripSyncDiagnostics } from "../trips/trip-workflow";

export type AppHealthTone = "good" | "warning" | "error" | "unknown";

export type AppHealthStatus = {
  label: string;
  tone: AppHealthTone;
  helper: string;
};

export function getTrackingHealthStatus(trackingDiagnostics?: TrackingDiagnostics | null): AppHealthStatus {
  if (!trackingDiagnostics) {
    return {
      label: "Not available",
      tone: "unknown",
      helper: "Tracking has not reported a health state yet.",
    };
  }

  if (trackingDiagnostics.availability.status === "unavailable") {
    const blockedBySettings = trackingDiagnostics.availability.reason === "permission-denied" ||
      trackingDiagnostics.availability.reason === "background-permission-denied" ||
      trackingDiagnostics.availability.reason === "location-services-disabled";

    return {
      label: blockedBySettings ? "Blocked" : "Unavailable",
      tone: blockedBySettings ? "error" : "unknown",
      helper: trackingDiagnostics.backgroundDiagnosisMessage || "Tracking is not available on this device right now.",
    };
  }

  if (
    trackingDiagnostics.healthState === "active-background-task-error" ||
    trackingDiagnostics.healthState === "permission-missing" ||
    trackingDiagnostics.healthState === "provider-disabled" ||
    trackingDiagnostics.healthState === "stopped-unexpectedly"
  ) {
    return {
      label: "Needs attention",
      tone: "error",
      helper: trackingDiagnostics.lastError || trackingDiagnostics.backgroundDiagnosisMessage || "Tracking needs a setting or service fixed.",
    };
  }

  if (
    trackingDiagnostics.healthState === "active-foreground-only" ||
    trackingDiagnostics.healthState === "active-background-not-firing" ||
    trackingDiagnostics.healthState === "active-stale" ||
    trackingDiagnostics.healthState === "active-no-samples" ||
    trackingDiagnostics.healthState === "session-mismatch" ||
    trackingDiagnostics.sampleArrivalState === "stale" ||
    trackingDiagnostics.likelyBackgroundRestricted
  ) {
    return {
      label: "Watch",
      tone: "warning",
      helper: trackingDiagnostics.backgroundDiagnosisMessage || "Tracking is running, but some signals may be delayed.",
    };
  }

  return {
    label: "Good",
    tone: "good",
    helper: trackingDiagnostics.active ? "Tracking is ready for the current trip." : "Tracking is available.",
  };
}

export function getSyncHealthStatus(syncDiagnostics: TripSyncDiagnostics, syncInProgress = false): AppHealthStatus {
  if (syncDiagnostics.syncFailedCount > 0 || syncDiagnostics.lastSyncError) {
    return {
      label: "Needs attention",
      tone: "error",
      helper: syncDiagnostics.lastSyncError ?? "One or more trips failed to sync.",
    };
  }

  if (
    syncInProgress ||
    syncDiagnostics.pendingSyncCount > 0 ||
    syncDiagnostics.syncingCount > 0 ||
    syncDiagnostics.pendingDeleteCount > 0 ||
    syncDiagnostics.localOnlyCount > 0
  ) {
    return {
      label: syncInProgress ? "Syncing" : "Pending",
      tone: "warning",
      helper: "Changes are saved locally and will sync when possible.",
    };
  }

  return {
    label: "Good",
    tone: "good",
    helper: syncDiagnostics.lastSyncSucceededAt ? "Latest trip changes have synced." : "No sync issues detected.",
  };
}

export function getPermissionHealthStatus(trackingDiagnostics?: TrackingDiagnostics | null): AppHealthStatus {
  const foregroundPermission = trackingDiagnostics?.foregroundPermission;
  const backgroundPermission = trackingDiagnostics?.backgroundPermission;

  if (!foregroundPermission && !backgroundPermission) {
    return {
      label: "Not available",
      tone: "unknown",
      helper: "Location permissions have not been checked yet.",
    };
  }

  if (foregroundPermission !== "granted") {
    return {
      label: "Missing",
      tone: "error",
      helper: "Foreground location permission is required for live speed and trip tracking.",
    };
  }

  if (backgroundPermission !== "granted") {
    return {
      label: "Limited",
      tone: "warning",
      helper: "Background location permission is needed for screen-lock tracking.",
    };
  }

  return {
    label: "Granted",
    tone: "good",
    helper: "Foreground and background location permissions are granted.",
  };
}

export function getLocationServicesHealthStatus(trackingDiagnostics?: TrackingDiagnostics | null): AppHealthStatus {
  if (trackingDiagnostics?.locationServicesEnabled === undefined) {
    return {
      label: "Not available",
      tone: "unknown",
      helper: "Device location services have not been checked yet.",
    };
  }

  if (!trackingDiagnostics.locationServicesEnabled) {
    return {
      label: "Disabled",
      tone: "error",
      helper: "Turn on device location services before recording trips.",
    };
  }

  return {
    label: "Enabled",
    tone: "good",
    helper: "Device location services are available.",
  };
}
