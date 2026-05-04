import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { formatDistanceKm, summarizeTripSession, type StartTripRequest, type TripMode } from "@gigeze/shared";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { RetroTripDashboard } from "../components/RetroTripDashboard";
import { ScreenContainer } from "../components/ScreenContainer";
import { StatusRow } from "../components/StatusRow";
import { TripLocationRow } from "../components/TripLocationRow";
import { TripRouteHero } from "../components/TripRouteHero";
import { TripSetupSection } from "../components/TripSetupSection";
import { useAuth } from "../features/auth/auth-context";
import { fetchMobileJourneyOptions, fetchMobileVehicleOptions } from "../features/trips/mobile-sync/vehicle-client";
import { trackingSampleStore } from "../features/trips/mobile-tracking/sample-store";
import type { TrackingSampleRecord } from "../features/trips/mobile-tracking/types";
import { formatGpsDiagnosticLine } from "../features/trips/live-motion-speed";
import { getLiveTripLocationPoints } from "../features/trips/live-trip-display";
import { useDrivingDisplayPreferences } from "../features/settings/driving-display-preferences";
import { calculateSampleDistanceKm } from "../features/trips/trip-distance";
import { formatDashboardDuration, getHomeDashboardDriveStateLabel, getHomeDashboardStatusLabel } from "../features/trips/trip-dashboard";
import { formatTripDateTime } from "../features/trips/trip-history-display";
import { getTripRouteCoordinates } from "../features/trips/trip-route-map";
import { getCurrentSpeedKmh } from "../features/trips/trip-speed";
import {
  applyVehicleToTripSetup,
  applyJourneyToTripSetup,
  applyTripModeToTripSetup,
  createTripSetupState,
  filterVehicleOptionsForTripMode,
  parseOdometerInput,
  sanitizeWholeNumberInput,
  type MobileJourneyOption,
  type MobileVehicleOption,
  type TripSetupState,
} from "../features/trips/trip-setup";
import { useDrivingScreenKeepAwake } from "../features/trips/use-home-screen-keep-awake";
import { useLiveMotionSpeed } from "../features/trips/use-live-motion-speed";
import { useTripState } from "../features/trips/trip-state";
import type { MobileTripSession } from "../features/trips/trip-workflow";

const liveDurationRefreshMs = 15000;
const trackingSupportMessageGraceMs = 20000;

function formatTripPurpose(tripPurpose: MobileTripSession["tripPurpose"]) {
  if (tripPurpose === "BUSINESS") {
    return "Business";
  }

  if (tripPurpose === "PRIVATE") {
    return "Personal";
  }

  return "Not available";
}

function formatTripMode(tripMode: TripMode | undefined) {
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

function getLocationSecondaryLabel(
  value: ReturnType<typeof getLiveTripLocationPoints>["start"],
  fallbackLabel: string,
) {
  if (!value) {
    return fallbackLabel;
  }

  return `${value.coordinate.latitude.toFixed(5)}, ${value.coordinate.longitude.toFixed(5)}`;
}

function getLiveTripSupportMessage(error: string | null, trackingStatus: string, active: boolean, activeForMs?: number) {
  if (error) {
    return error;
  }

  if (!active) {
    return null;
  }

  if (typeof activeForMs === "number" && activeForMs < trackingSupportMessageGraceMs) {
    return null;
  }

  if (trackingStatus.includes("NO SIGNAL")) {
    return "Live location updates are paused right now. Keep the app open and check permissions or signal.";
  }

  if (trackingStatus.includes("WEAK GPS")) {
    return "GPS is available, but accuracy is weak. Distance and speed stay conservative until the signal improves.";
  }

  return null;
}

export function LiveTripScreen() {
  const { session, supabaseSession } = useAuth();
  const { activeTrip, diagnostics, trackingDiagnostics, startTrip, stopTrip, updateTripMetadata, status, nowIso, error } = useTripState();
  const { preferences: drivingDisplayPreferences } = useDrivingDisplayPreferences();
  const [samples, setSamples] = useState<TrackingSampleRecord[]>([]);
  const [displayNowIso, setDisplayNowIso] = useState(() => new Date().toISOString());
  const [vehicleOptions, setVehicleOptions] = useState<MobileVehicleOption[]>([]);
  const [journeyOptions, setJourneyOptions] = useState<MobileJourneyOption[]>([]);
  const [vehicleOptionsError, setVehicleOptionsError] = useState<string | null>(null);
  const [journeyOptionsError, setJourneyOptionsError] = useState<string | null>(null);
  const [tripSetup, setTripSetup] = useState<TripSetupState>(() => createTripSetupState());
  const [odometerInput, setOdometerInput] = useState("");
  const [purposePromptTripId, setPurposePromptTripId] = useState<string | null>(null);
  const [purposePromptValue, setPurposePromptValue] = useState("");
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const liveMotion = useLiveMotionSpeed();

  useEffect(() => {
    const intervalId = setInterval(() => {
      setDisplayNowIso(new Date().toISOString());
    }, liveDurationRefreshMs);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setDisplayNowIso(nowIso);
  }, [nowIso]);

  useEffect(() => {
    let cancelled = false;

    async function loadSamples() {
      if (!activeTrip) {
        setSamples([]);
        return;
      }

      const storedSamples = await trackingSampleStore.listSamples(activeTrip.id);
      if (!cancelled) {
        setSamples(storedSamples);
      }
    }

    void loadSamples();

    return () => {
      cancelled = true;
    };
  }, [activeTrip, diagnostics.sampleCount, trackingDiagnostics?.importedSampleCount, trackingDiagnostics?.lastSampleAt]);

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
        setTripSetup((currentSetup) => {
          const compatibleVehicles = filterVehicleOptionsForTripMode(vehicles, currentSetup.tripMode);
          const currentVehicle = currentSetup.vehicleId
            ? compatibleVehicles.find((vehicle) => vehicle.id === currentSetup.vehicleId)
            : undefined;
          const nextVehicle = currentVehicle ?? compatibleVehicles.find((vehicle) => vehicle.isDefault) ?? compatibleVehicles[0];
          return applyVehicleToTripSetup(currentSetup, nextVehicle);
        });
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
  }, [accessToken]);

  useEffect(() => {
    if (!tripSetup.odometerEdited) {
      setOdometerInput(typeof tripSetup.startOdometer === "number" ? String(tripSetup.startOdometer) : "");
    }
  }, [tripSetup.odometerEdited, tripSetup.startOdometer]);

  const summary = useMemo(
    () => (activeTrip ? summarizeTripSession(activeTrip, displayNowIso) : null),
    [activeTrip, displayNowIso],
  );
  const routeCoordinates = useMemo(() => getTripRouteCoordinates(samples), [samples]);
  const locationPoints = useMemo(() => getLiveTripLocationPoints(samples), [samples]);
  const sampleDistanceKm = useMemo(() => calculateSampleDistanceKm(samples), [samples]);
  const sampleSpeedKmh = useMemo(() => getCurrentSpeedKmh(samples), [samples]);
  const speedKmh = liveMotion.speedKmh ?? sampleSpeedKmh;
  const statusText = getHomeDashboardStatusLabel({
    active: Boolean(activeTrip),
    trackingDiagnostics,
    liveMotionStatus: liveMotion.status,
    accuracyMeters: liveMotion.accuracyMeters,
  });
  const driveStateText = getHomeDashboardDriveStateLabel({
    liveMotionStatus: liveMotion.status,
    speedKmh,
  });
  useDrivingScreenKeepAwake({
    enabled: Boolean(activeTrip) && drivingDisplayPreferences.keepScreenOnWhileDriving,
    active: Boolean(activeTrip),
    liveMotionStatus: liveMotion.status,
    driveState: driveStateText,
    accuracyMeters: liveMotion.accuracyMeters,
  });
  const gpsSignalText = formatGpsDiagnosticLine(liveMotion.accuracyMeters, liveMotion.locationUpdatedAt, new Date(displayNowIso));
  const activeForMs = activeTrip ? new Date(displayNowIso).getTime() - new Date(activeTrip.startedAt).getTime() : undefined;
  const supportMessage = getLiveTripSupportMessage(error, statusText, Boolean(activeTrip), activeForMs);

  if (!activeTrip || !summary) {
    return (
      <ScreenContainer title="Live Trip">
        <TripSetupSection
          setup={tripSetup}
          vehicleOptions={vehicleOptions}
          journeyOptions={journeyOptions}
          odometerInput={odometerInput}
          vehicleOptionsError={vehicleOptionsError}
          journeyOptionsError={journeyOptionsError}
          onSelectVehicle={(vehicle) => setTripSetup((currentSetup) => applyVehicleToTripSetup(currentSetup, vehicle))}
          onSelectJourney={(Tour) => setTripSetup((currentSetup) => applyJourneyToTripSetup(currentSetup, Tour))}
          onChangeTripMode={(tripMode) => setTripSetup((currentSetup) => applyTripModeToTripSetup(currentSetup, tripMode, vehicleOptions))}
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

        <View style={styles.actions}>
          <PrimaryActionButton
            label="Start trip"
            onPress={async () => {
              await startTrip(buildStartTripRequest(tripSetup));
            }}
            disabled={status !== "ready"}
          />
        </View>

        {purposePromptTripId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What was this trip for?</Text>
            <TextInput
              accessibilityLabel="Trip purpose"
              onChangeText={setPurposePromptValue}
              placeholder="Client meeting, fuel Gig, personal errand"
              placeholderTextColor="#B8AFC0"
              style={styles.purposeInput}
              value={purposePromptValue}
            />
            <View style={styles.promptActions}>
              <PrimaryActionButton
                label="Save purpose"
                onPress={async () => {
                  await updateTripMetadata(purposePromptTripId, {
                    purpose: purposePromptValue.trim() || undefined,
                  });
                  setPurposePromptTripId(null);
                  setPurposePromptValue("");
                }}
              />
              <PrimaryActionButton
                label="Skip"
                onPress={() => {
                  setPurposePromptTripId(null);
                  setPurposePromptValue("");
                }}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ready when you are</Text>
          <Text style={styles.body}>
            Start a trip when you begin driving. Your route, speed, and current location will update here.
          </Text>
          {error ? <Text style={styles.notice}>{error}</Text> : null}
        </View>

        <TripRouteHero
          routeCoordinates={[]}
          overlayLabel="Distance"
          overlayValue="0 km"
          overlayDetail="Ready to record"
          fallbackTitle="Ready to record"
          fallbackBody="Your live route, speed, and current location will appear here."
        endMarkerLabel="N"
        endMarkerTone="current"
      />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Live Trip">
      <RetroTripDashboard
        speedKmh={speedKmh}
        distanceText={formatDistanceKm(sampleDistanceKm, { tripType: getDistanceDisplayTripType(activeTrip.tripMode) })}
        durationText={formatDashboardDuration(summary.durationMinutes)}
        statusText={statusText}
        driveStateText={driveStateText}
        gpsSignalText={gpsSignalText}
        active
      />

      <View style={styles.actions}>
        <PrimaryActionButton
          label="Gig trip"
          onPress={() => {
            Alert.alert("Gig trip?", "We’ll finish this trip and save it to your trip history.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Gig trip",
                style: "destructive",
                onPress: async () => {
                  const completedTrip = await stopTrip();
                  if (completedTrip) {
                    setPurposePromptTripId(completedTrip.id);
                    setPurposePromptValue(completedTrip.purpose ?? "");
                  }
                },
              },
            ]);
          }}
          variant="danger"
        />
      </View>

      {supportMessage ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Tracking needs attention</Text>
          <Text style={styles.notice}>{supportMessage}</Text>
        </View>
      ) : null}

      <TripRouteHero
        routeCoordinates={routeCoordinates}
        overlayLabel="Distance"
        overlayValue={formatDistanceKm(sampleDistanceKm, { tripType: getDistanceDisplayTripType(activeTrip.tripMode) })}
        overlayDetail={formatDashboardDuration(summary.durationMinutes)}
        fallbackTitle="Waiting for route"
        fallbackBody="As your location updates, your live route and current position will appear here."
        endMarkerLabel="N"
        endMarkerTone="current"
        followRouteUpdates
        reserveOverlaySpace
      />

      <View style={styles.card}>
        <TripLocationRow
          label="Start"
          title="Trip start"
          secondary={getLocationSecondaryLabel(locationPoints.start, "Waiting for first GPS fix")}
          dateTime={formatTripDateTime(locationPoints.start?.recordedAt ?? activeTrip.startedAt)}
        />
        <View style={styles.divider} />
        <TripLocationRow
          label="Current"
          title="Current location"
          secondary={getLocationSecondaryLabel(locationPoints.current, "Waiting for current location")}
          dateTime={formatTripDateTime(locationPoints.current?.recordedAt ?? trackingDiagnostics?.lastSampleAt ?? activeTrip.startedAt)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip metadata</Text>
        <StatusRow label="Tour" value={activeTrip.journeyTitle ?? activeTrip.journeyId ?? "Not available"} />
        {activeTrip.purpose ? <StatusRow label="Purpose" value={activeTrip.purpose} /> : null}
        <StatusRow label="Mode" value={formatTripMode(activeTrip.tripMode)} />
        {activeTrip.tripPurpose ? <StatusRow label="Business use" value={formatTripPurpose(activeTrip.tripPurpose)} /> : null}
        <StatusRow label="Vehicle" value={activeTrip.tripMode === "WALK" ? "Not needed" : (activeTrip.vehicleName ?? activeTrip.vehicleId ?? "Not available")} />
      </View>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  noticeCard: {
    backgroundColor: "rgba(255, 176, 0, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  cardTitle: {
    color: "#FFF7EA",
    fontSize: 18,
    fontWeight: "900",
  },
  divider: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    height: 1,
  },
  body: {
    color: "#B8AFC0",
    fontSize: 16,
    lineHeight: 23,
  },
  noticeTitle: {
    color: "#FFB000",
    fontSize: 16,
    fontWeight: "900",
  },
  notice: {
    color: "#FFB000",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  purposeInput: {
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#FFF7EA",
    fontSize: 15,
    fontWeight: "800",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promptActions: {
    gap: 8,
  },
  actions: {
    gap: 10,
    marginBottom: 4,
  },
});
