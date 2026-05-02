import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistanceKm, summarizeTripSession, type StartTripRequest, type TripMode } from "@gigeze/shared";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { RetroTripDashboard } from "../components/RetroTripDashboard";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { StatusRow } from "../components/StatusRow";
import { TripSetupSection } from "../components/TripSetupSection";
import { useAuth } from "../features/auth/auth-context";
import { useDrivingDisplayPreferences } from "../features/settings/driving-display-preferences";
import { fetchMobileJourneyOptions, fetchMobileVehicleOptions } from "../features/trips/mobile-sync/vehicle-client";
import { trackingSampleStore } from "../features/trips/mobile-tracking/sample-store";
import {
  formatDashboardDuration,
  getHomeDashboardDriveStateLabel,
  getHomeDashboardStatusLabel,
  hasReliableMovementForTripStartSuggestion,
  shouldShowTripStartSuggestion,
} from "../features/trips/trip-dashboard";
import { calculateSampleDistanceKm } from "../features/trips/trip-distance";
import {
  applyVehicleToTripSetup,
  applyJourneyToTripSetup,
  applyTripModeToTripSetup,
  createTripSetupState,
  parseOdometerInput,
  sanitizeWholeNumberInput,
  syncTripSetupVehicleSelection,
  type MobileJourneyOption,
  type MobileVehicleOption,
  type TripPurpose,
  type TripSetupState,
} from "../features/trips/trip-setup";
import { useTripState } from "../features/trips/trip-state";
import { getCurrentSpeedKmh } from "../features/trips/trip-speed";
import { formatGpsDiagnosticLine } from "../features/trips/live-motion-speed";
import { useHomeScreenKeepAwake } from "../features/trips/use-home-screen-keep-awake";
import { useLiveMotionSpeed } from "../features/trips/use-live-motion-speed";
import type { MainRouteName } from "../types/navigation";

type HomeScreenProps = {
  navigate: (routeName: MainRouteName) => void;
};

export function HomeScreen({ navigate }: HomeScreenProps) {
  const { session, supabaseSession } = useAuth();
  const { preferences: drivingDisplayPreferences } = useDrivingDisplayPreferences();
  const { activeTrip, recentTrips, startTrip, status, nowIso, error, trackingDiagnostics, syncDiagnostics } = useTripState();
  const liveMotion = useLiveMotionSpeed();
  const [gpsDiagnosticNowIso, setGpsDiagnosticNowIso] = useState(() => new Date().toISOString());
  const [reliableMovementSinceIso, setReliableMovementSinceIso] = useState<string | undefined>(undefined);
  const [tripStartSuggestionDismissed, setTripStartSuggestionDismissed] = useState(false);
  const [tripSampleSpeedKmh, setTripSampleSpeedKmh] = useState<number | undefined>(undefined);
  const [currentDistanceKm, setCurrentDistanceKm] = useState(0);
  const [vehicleOptions, setVehicleOptions] = useState<MobileVehicleOption[]>([]);
  const [journeyOptions, setJourneyOptions] = useState<MobileJourneyOption[]>([]);
  const [vehicleOptionsError, setVehicleOptionsError] = useState<string | null>(null);
  const [journeyOptionsError, setJourneyOptionsError] = useState<string | null>(null);
  const [tripSetup, setTripSetup] = useState<TripSetupState>(() => createTripSetupState());
  const [odometerInput, setOdometerInput] = useState("");
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const summary = activeTrip ? summarizeTripSession(activeTrip, nowIso) : null;
  const tripsNeedingSync = syncDiagnostics.pendingSyncCount + syncDiagnostics.syncFailedCount + syncDiagnostics.syncingCount;
  const syncSummary =
    tripsNeedingSync > 0
      ? `${tripsNeedingSync} trip${tripsNeedingSync === 1 ? "" : "s"} waiting to save`
      : "All completed trips are saved";
  const trackingSummary = trackingDiagnostics
    ? trackingDiagnostics.availability.status === "available"
      ? "Tracking ready"
      : "Tracking needs attention"
    : "Checking tracking";
  const dashboardSpeedKmh = liveMotion.speedKmh ?? tripSampleSpeedKmh;
  const dashboardDistanceKm = currentDistanceKm > 0 ? currentDistanceKm : summary?.distanceKilometers ?? 0;
  const dashboardStatus = getHomeDashboardStatusLabel({
    active: Boolean(activeTrip),
    trackingDiagnostics,
    liveMotionStatus: liveMotion.status,
    accuracyMeters: liveMotion.accuracyMeters,
  });
  const dashboardDriveState = getHomeDashboardDriveStateLabel({
    liveMotionStatus: liveMotion.status,
    speedKmh: dashboardSpeedKmh,
  });
  useHomeScreenKeepAwake({
    enabled: drivingDisplayPreferences.keepScreenOnWhileDriving,
    active: Boolean(activeTrip),
    liveMotionStatus: liveMotion.status,
    driveState: dashboardDriveState,
    accuracyMeters: liveMotion.accuracyMeters,
  });
  const reliableMovementForSuggestion = hasReliableMovementForTripStartSuggestion({
    active: Boolean(activeTrip),
    liveMotionStatus: liveMotion.status,
    driveState: dashboardDriveState,
    accuracyMeters: liveMotion.accuracyMeters,
  });
  const showTripStartSuggestion = shouldShowTripStartSuggestion({
    active: Boolean(activeTrip),
    liveMotionStatus: liveMotion.status,
    driveState: dashboardDriveState,
    accuracyMeters: liveMotion.accuracyMeters,
    reliableMovementSince: reliableMovementSinceIso,
    dismissed: tripStartSuggestionDismissed,
    now: new Date(gpsDiagnosticNowIso),
  });
  const gpsDiagnosticLine = formatGpsDiagnosticLine(
    liveMotion.accuracyMeters,
    liveMotion.locationUpdatedAt,
    new Date(gpsDiagnosticNowIso),
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setGpsDiagnosticNowIso(new Date().toISOString());
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSetupOptions() {
      if (!accessToken) {
        setVehicleOptions([]);
        setJourneyOptions([]);
        return;
      }

      const [vehicleResult, journeyResult] = await Promise.allSettled([
          fetchMobileVehicleOptions(accessToken),
          fetchMobileJourneyOptions(accessToken),
      ]);
      if (cancelled) {
        return;
      }

      if (vehicleResult.status === "fulfilled") {
        const vehicles = vehicleResult.value;
        setVehicleOptions(vehicles);
        setVehicleOptionsError(null);
        setTripSetup((currentSetup) => syncTripSetupVehicleSelection(currentSetup, vehicles, recentTrips));
      } else {
        setVehicleOptions([]);
        setVehicleOptionsError(vehicleResult.reason instanceof Error ? vehicleResult.reason.message : "Vehicle options are unavailable right now.");
      }

      if (journeyResult.status === "fulfilled") {
        const Tours = journeyResult.value;
        setJourneyOptions(Tours);
        setJourneyOptionsError(null);
        setTripSetup((currentSetup) => {
          const currentJourney = currentSetup.journeyId
            ? Tours.find((Tour) => Tour.id === currentSetup.journeyId)
            : undefined;
          return applyJourneyToTripSetup(currentSetup, currentJourney);
        });
      } else {
        setJourneyOptions([]);
        setJourneyOptionsError(journeyResult.reason instanceof Error ? journeyResult.reason.message : "Tour options are unavailable right now.");
      }
    }

    void loadSetupOptions();

    return () => {
      cancelled = true;
    };
  }, [accessToken, recentTrips]);

  useEffect(() => {
    if (!tripSetup.odometerEdited) {
      setOdometerInput(typeof tripSetup.startOdometer === "number" ? String(tripSetup.startOdometer) : "");
    }
  }, [tripSetup.odometerEdited, tripSetup.startOdometer]);

  useEffect(() => {
    if (reliableMovementForSuggestion) {
      setReliableMovementSinceIso((currentValue) => currentValue ?? new Date().toISOString());
      return;
    }

    setReliableMovementSinceIso(undefined);
    setTripStartSuggestionDismissed(false);
  }, [reliableMovementForSuggestion]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardMetrics() {
      if (!activeTrip) {
        setTripSampleSpeedKmh(undefined);
        setCurrentDistanceKm(0);
        return;
      }

      const samples = await trackingSampleStore.listSamples(activeTrip.id);
      if (!cancelled) {
        setTripSampleSpeedKmh(getCurrentSpeedKmh(samples));
        setCurrentDistanceKm(calculateSampleDistanceKm(samples));
      }
    }

    void loadDashboardMetrics();

    return () => {
      cancelled = true;
    };
  }, [activeTrip, activeTrip?.sampleCount, trackingDiagnostics?.importedSampleCount, trackingDiagnostics?.lastSampleAt]);

  async function handleStartTrip() {
    await startTrip(buildStartTripRequest(tripSetup));
    navigate("liveTrip");
  }

  async function handleSuggestedStartTrip() {
    setTripStartSuggestionDismissed(true);
    await handleStartTrip();
  }

  return (
    <ScreenContainer title="GigEze">
      <RetroTripDashboard
        speedKmh={dashboardSpeedKmh}
        distanceText={formatDistanceKm(dashboardDistanceKm, { tripType: getDistanceDisplayTripType(activeTrip?.tripMode) })}
        durationText={formatDashboardDuration(summary?.durationMinutes)}
        statusText={dashboardStatus}
        driveStateText={dashboardDriveState}
        gpsSignalText={gpsDiagnosticLine}
        active={Boolean(activeTrip) || liveMotion.status === "available"}
      />

      {showTripStartSuggestion ? (
        <View style={styles.suggestion}>
          <View style={styles.suggestionTextGroup}>
            <Text style={styles.suggestionTitle}>Looks like you are moving</Text>
            <Text style={styles.suggestionBody}>Start a trip when ready to record this drive.</Text>
          </View>
          <View style={styles.suggestionActions}>
            <PrimaryActionButton label="Start Trip" onPress={handleSuggestedStartTrip} disabled={status !== "ready"} />
            <Pressable accessibilityRole="button" onPress={() => setTripStartSuggestionDismissed(true)} style={styles.dismissButton}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScreenSection title="Today" caption="Ready to drive. Start a trip or begin moving.">
        <Text style={styles.body}>Signed in as {session?.user.displayName ?? session?.user.email ?? "local user"}.</Text>
        {status === "initializing" ? <Text style={styles.body}>Restoring your trips.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScreenSection>

      <ScreenSection title="Current trip">
        {summary ? (
          <View style={styles.stack}>
            <Text style={styles.metric}>{summary.durationMinutes} min active</Text>
            <Text style={styles.body}>{activeTrip?.title ?? "Active trip"}</Text>
            <StatusRow label="Status" value={summary.status} />
            <StatusRow label="Tour" value={activeTrip?.journeyTitle ?? activeTrip?.journeyId ?? "Not available"} />
            <StatusRow label="Mode" value={formatTripModeLabel(activeTrip?.tripMode)} />
            <StatusRow label="Vehicle" value={activeTrip?.tripMode === "WALK" ? "Not needed" : (activeTrip?.vehicleName ?? activeTrip?.vehicleId ?? "Not available")} />
            {activeTrip?.tripPurpose ? <StatusRow label="Business use" value={formatTripPurposeLabel(activeTrip.tripPurpose)} /> : null}
            <StatusRow label="Start odometer" value={activeTrip?.tripMode === "WALK" ? "Not used" : formatOdometer(activeTrip?.startOdometer)} />
            <StatusRow label="Tracking" value={trackingSummary} />
            <StatusRow label="Started" value={new Date(summary.startedAt).toLocaleString()} />
            <StatusRow label="Distance" value={formatDistanceKm(summary.distanceKilometers, { tripType: getDistanceDisplayTripType(activeTrip?.tripMode) })} />
            <PrimaryActionButton label="Resume trip" onPress={() => navigate("liveTrip")} />
          </View>
        ) : (
          <View style={styles.stack}>
            <Text style={styles.body}>Ready to drive. Start a trip or begin moving.</Text>
            <TripSetupSection
              setup={tripSetup}
              vehicleOptions={vehicleOptions}
              journeyOptions={journeyOptions}
              odometerInput={odometerInput}
              vehicleOptionsError={vehicleOptionsError}
              journeyOptionsError={journeyOptionsError}
              onSelectVehicle={(vehicle) => setTripSetup((currentSetup) => applyVehicleToTripSetup(currentSetup, vehicle))}
              onSelectJourney={(Tour) => setTripSetup((currentSetup) => applyJourneyToTripSetup(currentSetup, Tour))}
              onChangeTripMode={(tripMode) => setTripSetup((currentSetup) => applyTripModeToTripSetup(currentSetup, tripMode, vehicleOptions, recentTrips))}
              onChangePurpose={(tripPurpose) => setTripSetup((currentSetup) => ({ ...currentSetup, tripPurpose, purposeEdited: true }))}
              onChangeOdometer={(value) => {
                const sanitizedValue = sanitizeWholeNumberInput(value);
                setOdometerInput(sanitizedValue);
                setTripSetup((currentSetup) => ({
                  ...currentSetup,
                  startOdometer: parseOdometerInput(sanitizedValue),
                  odometerEdited: true,
                }));
              }}
            />
            <PrimaryActionButton label="Start trip" onPress={handleStartTrip} disabled={status !== "ready"} />
          </View>
        )}
      </ScreenSection>

      <ScreenSection title="Quick access">
        <View style={styles.actions}>
          <StatusRow label="Recent trips" value={String(recentTrips.length)} />
          <StatusRow label="Trips waiting to save" value={String(tripsNeedingSync)} />
          <Text style={styles.body}>{syncSummary}.</Text>
          <PrimaryActionButton label="Recent trips" onPress={() => navigate("tripHistory")} variant="secondary" />
          <PrimaryActionButton label="Settings" onPress={() => navigate("settingsDebug")} variant="secondary" />
        </View>
      </ScreenSection>
    </ScreenContainer>
  );
}

function buildStartTripRequest(setup: TripSetupState): StartTripRequest {
  return {
    journeyId: setup.journeyId,
    journeyTitle: setup.journeyTitle,
    tripMode: setup.tripMode,
    vehicleId: setup.tripMode === "WALK" ? undefined : setup.vehicleId,
    vehicleName: setup.tripMode === "WALK" ? undefined : setup.vehicleName,
    tripPurpose: setup.businessSplitEnabled ? setup.tripPurpose : undefined,
    startOdometer: setup.tripMode === "WALK" ? undefined : setup.startOdometer,
  };
}

function formatTripPurposeLabel(purpose: TripPurpose | undefined) {
  return purpose === "BUSINESS" ? "Business" : purpose === "PRIVATE" ? "Personal" : "Not available";
}

function formatTripModeLabel(tripMode: TripMode | undefined) {
  if (tripMode === "WALK") {
    return "Walk";
  }

  if (tripMode === "RIDE") {
    return "Ride";
  }

  return "Drive";
}

function getDistanceDisplayTripType(tripMode: TripMode | undefined) {
  if (tripMode === "WALK") {
    return "walking" as const;
  }

  if (tripMode === "RIDE") {
    return "ride" as const;
  }

  return "driving" as const;
}

function formatOdometer(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value} km` : "Not available";
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  actions: {
    gap: 10,
  },
  suggestion: {
    backgroundColor: "#f4f1e8",
    borderColor: "#cdd8d1",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  suggestionTextGroup: {
    gap: 4,
  },
  suggestionTitle: {
    color: "#1f332d",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  suggestionBody: {
    color: "#52675f",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  suggestionActions: {
    gap: 8,
  },
  dismissButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dismissText: {
    color: "#52675f",
    fontSize: 14,
    fontWeight: "800",
  },
  body: {
    color: "#32453d",
    fontSize: 16,
    lineHeight: 23,
  },
  error: {
    color: "#9f3a2f",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  metric: {
    color: "#1d5c49",
    fontSize: 32,
    fontWeight: "900",
  },
});
