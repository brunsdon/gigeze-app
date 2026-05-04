import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { StatusRow } from "../components/StatusRow";
import { useAuth } from "../features/auth/auth-context";
import {
  getLocationServicesHealthStatus,
  getPermissionHealthStatus,
  getSyncHealthStatus,
  getTrackingHealthStatus,
  type AppHealthStatus,
} from "../features/settings/app-health";
import { useAppMetadata } from "../features/settings/use-app-metadata";
import {
  checkWebApiConnectivity,
  createDiagnosticTripSyncInput,
  isProductionWebApiBaseUrl,
  syncCompletedTripToBackend,
  type ApiConnectivityResult,
  type CompleteTripSyncResult,
} from "../features/trips/mobile-sync/sync-client";
import { useTripState } from "../features/trips/trip-state";

function formatDateTime(timestampIso: string | null | undefined) {
  return timestampIso ? new Date(timestampIso).toLocaleString() : "Not available";
}

type DiagnosticsScreenProps = {
  onBack: () => void;
};

export function DiagnosticsScreen({ onBack }: DiagnosticsScreenProps) {
  const config = useAppMetadata();
  const { status, session, supabaseSession, sessionWasRestored, isConfigured, error } = useAuth();
  const {
    activeTrip,
    diagnostics,
    recentTrips,
    status: tripStatus,
    error: tripError,
    storageSnapshot,
    syncDiagnostics,
    syncInProgress,
    syncPendingTrips,
    trackingDiagnostics,
  } = useTripState();
  const [apiConnectivity, setApiConnectivity] = useState<ApiConnectivityResult | null>(null);
  const [apiCheckInProgress, setApiCheckInProgress] = useState(false);
  const [testSyncResult, setTestSyncResult] = useState<CompleteTripSyncResult | null>(null);
  const [testSyncInProgress, setTestSyncInProgress] = useState(false);

  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const authReady = isConfigured && status === "signedIn" && Boolean(session) && Boolean(accessToken);
  const trackingAvailable = trackingDiagnostics?.availability.status === "available" || diagnostics.trackingHealth === "ready";
  const backgroundSupportedInDevBuild = config.isDevelopmentBuild && Boolean(trackingDiagnostics?.supportsBackgroundTracking);
  const healthSummary = [
    { title: "Tracking", status: getTrackingHealthStatus(trackingDiagnostics) },
    { title: "Sync", status: getSyncHealthStatus(syncDiagnostics, syncInProgress) },
    { title: "Permissions", status: getPermissionHealthStatus(trackingDiagnostics) },
    { title: "Location services", status: getLocationServicesHealthStatus(trackingDiagnostics) },
  ];
  const apiReachableLabel = apiConnectivity
    ? apiConnectivity.status === "ok"
      ? `ok${apiConnectivity.responseTimeMs === undefined ? "" : ` (${apiConnectivity.responseTimeMs}ms)`}`
      : `failed${apiConnectivity.error ? `: ${apiConnectivity.error}` : ""}`
    : "Not checked";

  async function runApiCheck() {
    setApiCheckInProgress(true);
    try {
      setApiConnectivity(await checkWebApiConnectivity(config.webApiUrl));
    } finally {
      setApiCheckInProgress(false);
    }
  }

  async function runTestSync() {
    if (!accessToken) {
      setTestSyncResult({
        ok: false,
        error: "Signed-in session is not available for trip sync. Sign in again, then retry.",
      });
      return;
    }

    setTestSyncInProgress(true);
    try {
      const { trip, samples } = createDiagnosticTripSyncInput();
      setTestSyncResult(await syncCompletedTripToBackend(trip, samples, accessToken));
    } finally {
      setTestSyncInProgress(false);
    }
  }

  return (
    <ScreenContainer title="App Health">
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.textButton}>
        <Text style={styles.textButtonLabel}>Back to settings</Text>
      </Pressable>

      <ScreenSection title="Summary" caption="A quick read on whether GigEze is ready for trip recording.">
        <View style={styles.healthGrid}>
          {healthSummary.map((item) => (
            <HealthStatusCard
              key={item.title}
              title={item.title}
              status={item.status}
            />
          ))}
        </View>
      </ScreenSection>

      <Text style={styles.detailsHeading}>Detailed diagnostics</Text>

      <ScreenSection title="App metadata">
        <View style={styles.stack}>
          <StatusRow label="App" value={config.appName} />
          <StatusRow label="Version" value={config.appVersion} />
          <StatusRow label="Build" value={config.appBuild} />
          <StatusRow label="Runtime" value={config.runtimeKind} />
          <StatusRow label="Runtime raw" value={config.runtimeRaw} />
          <StatusRow label="Expo Go" value={config.isExpoGo ? "yes" : "no"} />
          <StatusRow label="Development build" value={config.isDevelopmentBuild ? "yes" : "no"} />
          <StatusRow label="Environment" value={config.environmentName} />
          <StatusRow label="Platform" value={config.platformLabel} />
          <StatusRow label="Device kind" value={config.deviceKind} />
        </View>
      </ScreenSection>

      <ScreenSection title="Integration readiness">
        <View style={styles.stack}>
          <StatusRow label="Auth state" value={status} />
          <StatusRow label="User" value={session?.user.email ?? session?.user.displayName ?? "Not available"} />
          <StatusRow label="Supabase config" value={isConfigured ? "configured" : "missing"} />
          <StatusRow label="Supabase URL configured" value={config.supabaseUrlConfigured ? "yes" : "no"} />
          <StatusRow label="Supabase anon key configured" value={config.supabaseAnonKeyConfigured ? "yes" : "no"} />
          <StatusRow label="Session restored" value={sessionWasRestored ? "yes" : "no"} />
          <StatusRow label="Auth session present" value={session ? "yes" : "no"} />
          <StatusRow label="Session expires" value={session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : "Not available"} />
          <StatusRow label="Refresh token" value={supabaseSession?.refresh_token ? "present" : "missing"} />
          <StatusRow label="Access token present" value={accessToken ? "yes" : "no"} />
          <StatusRow label="Web API URL" value={config.webApiUrl} />
          <StatusRow label="Is production URL?" value={isProductionWebApiBaseUrl(config.webApiUrl) ? "yes" : "no"} />
          <StatusRow label="Web API warning" value={config.webApiUrlWarning ?? "Not available"} />
          <StatusRow label="Auth error" value={error ?? "Not available"} />
        </View>
      </ScreenSection>

      <ScreenSection title="Field Test Readiness">
        <View style={styles.stack}>
          <StatusRow label="API reachable" value={apiReachableLabel} />
          <StatusRow label="Auth ready" value={authReady ? "yes" : "no"} />
          <StatusRow label="Tracking ready" value={trackingAvailable ? "yes" : "no"} />
          <StatusRow label="Background supported (dev build)" value={backgroundSupportedInDevBuild ? "yes" : "no"} />
          <StatusRow label="Last test sync" value={testSyncResult ? testSyncResult.ok ? `success${testSyncResult.backendTripId ? `: ${testSyncResult.backendTripId}` : ""}` : `failed: ${testSyncResult.error}` : "Not run"} />
        </View>
        <View style={styles.actions}>
          <PrimaryActionButton
            label={apiCheckInProgress ? "Checking API..." : "Check API Reachability"}
            onPress={runApiCheck}
            variant="secondary"
            disabled={apiCheckInProgress}
          />
          <PrimaryActionButton
            label={testSyncInProgress ? "Testing Sync..." : "Test Sync to Production"}
            onPress={runTestSync}
            variant="secondary"
            disabled={testSyncInProgress}
          />
        </View>
        <Text style={styles.body}>
          Test sync sends a zero-distance diagnostic trip for today and reuses the same draft when repeated.
        </Text>
      </ScreenSection>

      <ScreenSection title="Trip storage">
        <View style={styles.stack}>
          <StatusRow label="Trip state" value={tripStatus} />
          <StatusRow label="Active trip sync state" value={diagnostics.syncState} />
          <StatusRow label="Sync running" value={syncInProgress ? "yes" : "no"} />
          <StatusRow label="Pending sync" value={String(syncDiagnostics.pendingSyncCount)} />
          <StatusRow label="Syncing" value={String(syncDiagnostics.syncingCount)} />
          <StatusRow label="Sync failed" value={String(syncDiagnostics.syncFailedCount)} />
          <StatusRow label="Synced trips" value={String(syncDiagnostics.syncedCount)} />
          <StatusRow label="Local-only trips" value={String(syncDiagnostics.localOnlyCount)} />
          <StatusRow label="Last sync attempt" value={syncDiagnostics.lastSyncAttemptAt ? new Date(syncDiagnostics.lastSyncAttemptAt).toLocaleString() : "Not available"} />
          <StatusRow label="Last sync success" value={syncDiagnostics.lastSyncSucceededAt ? new Date(syncDiagnostics.lastSyncSucceededAt).toLocaleString() : "Not available"} />
          <StatusRow label="Last sync error" value={syncDiagnostics.lastSyncError ?? "Not available"} />
          <StatusRow label="Active trip" value={activeTrip ? "yes" : "no"} />
          <StatusRow label="Active trip id" value={activeTrip?.id ?? "Not available"} />
          <StatusRow label="Active trip title" value={activeTrip?.title ?? "Not available"} />
          <StatusRow label="Recent trips" value={String(recentTrips.length)} />
          <StatusRow label="Stored active trip" value={storageSnapshot.hasActiveTrip ? "yes" : "no"} />
          <StatusRow label="Stored recent trips" value={String(storageSnapshot.recentTripsCount)} />
          <StatusRow label="Trip storage error" value={tripError ?? "Not available"} />
          <StatusRow label="Tracking capability" value={diagnostics.trackingHealth} />
          <StatusRow label="Tracking health" value={trackingDiagnostics?.healthState ?? "Not available"} />
          <StatusRow label="Tracking runtime" value={trackingDiagnostics?.runtimeMode ?? "Not available"} />
          <StatusRow label="Background supported" value={trackingDiagnostics?.supportsBackgroundTracking ? "yes" : "no"} />
          <StatusRow label="Tracking platform" value={trackingDiagnostics?.platform ?? "Not available"} />
          <StatusRow label="Tracking availability" value={trackingDiagnostics?.availability.status ?? "Not available"} />
          <StatusRow label="Tracking reason" value={trackingDiagnostics?.availability.status === "unavailable" ? trackingDiagnostics.availability.reason : "Not available"} />
          <StatusRow label="Location services" value={trackingDiagnostics?.locationServicesEnabled === undefined ? "Not available" : trackingDiagnostics.locationServicesEnabled ? "enabled" : "disabled"} />
          <StatusRow label="Tracking active" value={trackingDiagnostics?.active ? "yes" : "no"} />
          <StatusRow label="Tracking operation" value={trackingDiagnostics?.operationState ?? "Not available"} />
          <StatusRow label="Sample arrival" value={trackingDiagnostics?.sampleArrivalState ?? "Not available"} />
          <StatusRow label="Background diagnosis" value={trackingDiagnostics?.backgroundDiagnosis ?? "Not available"} />
          <StatusRow label="Likely OS restriction" value={trackingDiagnostics?.likelyBackgroundRestricted ? "yes" : "no"} />
          <StatusRow label="Last sample age" value={trackingDiagnostics?.secondsSinceLastSample === undefined ? "Not available" : `${trackingDiagnostics.secondsSinceLastSample}s`} />
          <StatusRow label="Stale threshold" value={`${trackingDiagnostics?.staleThresholdSeconds ?? 0}s`} />
          <StatusRow label="Expected service" value={trackingDiagnostics?.expectedServiceState ?? "Not available"} />
          <StatusRow label="Actual service" value={trackingDiagnostics?.actualServiceState ?? "Not available"} />
          <StatusRow label="State matches" value={trackingDiagnostics?.stateMatchesExpectation ? "yes" : "no"} />
          <StatusRow label="Session mismatch" value={trackingDiagnostics?.sessionMismatch ? "yes" : "no"} />
          <StatusRow label="Stale service" value={trackingDiagnostics?.staleServiceDetected ? "yes" : "no"} />
          <StatusRow label="Native buffer" value={String(trackingDiagnostics?.nativeBufferedCount ?? 0)} />
          <StatusRow label="Imported samples" value={String(trackingDiagnostics?.importedSampleCount ?? 0)} />
          <StatusRow label="Last sample" value={trackingDiagnostics?.lastSampleAt ? new Date(trackingDiagnostics.lastSampleAt).toLocaleString() : "Not available"} />
          <StatusRow label="Last drain" value={trackingDiagnostics?.lastDrainAt ? new Date(trackingDiagnostics.lastDrainAt).toLocaleString() : "Not available"} />
          <StatusRow label="Last import" value={trackingDiagnostics?.lastImportAt ? new Date(trackingDiagnostics.lastImportAt).toLocaleString() : "Not available"} />
          <StatusRow label="Last recovery" value={trackingDiagnostics?.lastRecoveryAt ? new Date(trackingDiagnostics.lastRecoveryAt).toLocaleString() : "Not available"} />
          <StatusRow label="Last Gig" value={trackingDiagnostics?.lastStopAt ? new Date(trackingDiagnostics.lastStopAt).toLocaleString() : "Not available"} />
          <StatusRow label="Gig verified" value={trackingDiagnostics?.stopVerified === undefined ? "Not available" : trackingDiagnostics.stopVerified ? "yes" : "no"} />
          <StatusRow label="Foreground permission" value={trackingDiagnostics?.foregroundPermission ?? "Not available"} />
          <StatusRow label="Background permission" value={trackingDiagnostics?.backgroundPermission ?? "Not available"} />
          <StatusRow label="Background guidance" value={trackingDiagnostics?.backgroundDiagnosisMessage ?? "Not available"} />
          <StatusRow label="Tracking error" value={trackingDiagnostics?.lastError ?? "Not available"} />
        </View>
        <PrimaryActionButton
          label="Retry trip sync"
          onPress={async () => {
            await syncPendingTrips();
          }}
          variant="secondary"
          disabled={syncInProgress}
        />
      </ScreenSection>

      <ScreenSection title="Tracking diagnostics (detailed)">
        <View style={styles.stack}>
          {config.isExpoGo ? (
            <Text style={styles.warning}>Background tracking requires a development build. Expo Go cannot validate Android screen-lock/background tracking.</Text>
          ) : null}
          {activeTrip && trackingDiagnostics?.backgroundTaskStarted && trackingDiagnostics.backgroundTaskCallbackCount === 0 ? (
            <Text style={styles.warning}>No background callbacks detected yet. Check location permissions, location services, and Android battery/background restrictions.</Text>
          ) : null}
          {trackingDiagnostics?.likelyBackgroundRestricted ? (
            <Text style={styles.warning}>Likely OS restriction: on a physical phone, allow unrestricted battery/background activity for this development build and repeat the screen-lock test.</Text>
          ) : null}
          <StatusRow label="Runtime mode" value={trackingDiagnostics?.runtimeMode ?? "Not available"} />
          <StatusRow label="Foreground permission" value={trackingDiagnostics?.foregroundPermission ?? "Not available"} />
          <StatusRow label="Background permission" value={trackingDiagnostics?.backgroundPermission ?? "Not available"} />
          <StatusRow label="Location services" value={trackingDiagnostics?.locationServicesEnabled === undefined ? "Not available" : trackingDiagnostics.locationServicesEnabled ? "enabled" : "disabled"} />
          <StatusRow label="Foreground watcher active" value={trackingDiagnostics?.foregroundWatchActive ? "yes" : "no"} />
          <StatusRow label="Background task defined" value={trackingDiagnostics?.backgroundTaskDefined ? "yes" : "no"} />
          <StatusRow label="Background task started" value={trackingDiagnostics?.backgroundTaskStarted ? "yes" : "no"} />
          <StatusRow label="Background callback state" value={trackingDiagnostics?.backgroundCallbackState ?? "Not available"} />
          <StatusRow label="Background callback count" value={String(trackingDiagnostics?.backgroundTaskCallbackCount ?? 0)} />
          <StatusRow label="Last background callback" value={formatDateTime(trackingDiagnostics?.lastBackgroundTaskCallbackAt)} />
          <StatusRow label="Last background task error" value={trackingDiagnostics?.lastBackgroundTaskError ?? "Not available"} />
          <StatusRow label="Last background error at" value={formatDateTime(trackingDiagnostics?.lastBackgroundTaskErrorAt)} />
          <StatusRow label="Foreground samples" value={String(trackingDiagnostics?.foregroundSampleCount ?? 0)} />
          <StatusRow label="Background samples" value={String(trackingDiagnostics?.backgroundSampleCount ?? 0)} />
          <StatusRow label="Last foreground sample" value={formatDateTime(trackingDiagnostics?.lastForegroundSampleAt)} />
          <StatusRow label="Last background sample" value={formatDateTime(trackingDiagnostics?.lastBackgroundSampleAt)} />
          <StatusRow label="Imported samples" value={String(trackingDiagnostics?.importedSampleCount ?? 0)} />
          <StatusRow label="Native buffer" value={String(trackingDiagnostics?.nativeBufferedCount ?? 0)} />
          <StatusRow label="Tracking health" value={trackingDiagnostics?.healthState ?? "Not available"} />
          <StatusRow label="Background diagnosis" value={trackingDiagnostics?.backgroundDiagnosis ?? "Not available"} />
          <StatusRow label="Background guidance" value={trackingDiagnostics?.backgroundDiagnosisMessage ?? "Not available"} />
          <StatusRow label="Tracking error" value={trackingDiagnostics?.lastError ?? "Not available"} />
        </View>
      </ScreenSection>
    </ScreenContainer>
  );
}

function HealthStatusCard({ title, status }: { title: string; status: AppHealthStatus }) {
  return (
    <View style={[styles.healthCard, styles[`healthCard_${status.tone}`]]}>
      <View style={styles.healthHeader}>
        <Text style={styles.healthTitle}>{title}</Text>
        <View style={[styles.healthDot, styles[`healthDot_${status.tone}`]]} />
      </View>
      <Text style={[styles.healthLabel, styles[`healthLabel_${status.tone}`]]}>{status.label}</Text>
      <Text style={styles.healthHelper}>{status.helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 2,
  },
  body: {
    color: "#B8AFC0",
    fontSize: 16,
    lineHeight: 23,
  },
  actions: {
    gap: 10,
    marginTop: 12,
  },
  textButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingVertical: 10,
  },
  textButtonLabel: {
    color: "#FFB000",
    fontSize: 15,
    fontWeight: "900",
  },
  warning: {
    color: "#FFB000",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  detailsHeading: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  healthGrid: {
    gap: 10,
  },
  healthCard: {
    borderLeftWidth: 5,
    borderRadius: 8,
    gap: 6,
    padding: 12,
  },
  healthCard_good: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    borderLeftColor: "#00E5A8",
  },
  healthCard_warning: {
    backgroundColor: "rgba(255, 176, 0, 0.16)",
    borderLeftColor: "#FFB000",
  },
  healthCard_error: {
    backgroundColor: "rgba(255, 46, 99, 0.16)",
    borderLeftColor: "#FF2E63",
  },
  healthCard_unknown: {
    backgroundColor: "#1E1724",
    borderLeftColor: "#B8AFC0",
  },
  healthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  healthTitle: {
    color: "#FFF7EA",
    fontSize: 15,
    fontWeight: "900",
  },
  healthDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  healthDot_good: {
    backgroundColor: "#00E5A8",
  },
  healthDot_warning: {
    backgroundColor: "#FFB000",
  },
  healthDot_error: {
    backgroundColor: "#FF2E63",
  },
  healthDot_unknown: {
    backgroundColor: "#B8AFC0",
  },
  healthLabel: {
    fontSize: 18,
    fontWeight: "900",
  },
  healthLabel_good: {
    color: "#FFB000",
  },
  healthLabel_warning: {
    color: "#FFB000",
  },
  healthLabel_error: {
    color: "#FF2E63",
  },
  healthLabel_unknown: {
    color: "#B8AFC0",
  },
  healthHelper: {
    color: "#B8AFC0",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
});
