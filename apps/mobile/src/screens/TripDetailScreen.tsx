import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { formatDistanceKm, type TripMode } from "@gigeze/shared";
import { ExternalMediaSection } from "../components/ExternalMediaSection";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { StatusRow } from "../components/StatusRow";
import { TripLocationRow } from "../components/TripLocationRow";
import { TripRouteHero } from "../components/TripRouteHero";
import { useAuth } from "../features/auth/auth-context";
import { fetchDrivingLogRoutePreview } from "../features/trips/mobile-sync/sync-client";
import { fetchMobileVehicleOptions } from "../features/trips/mobile-sync/vehicle-client";
import { trackingSampleStore } from "../features/trips/mobile-tracking/sample-store";
import type { TrackingSampleRecord } from "../features/trips/mobile-tracking/types";
import { getTripCoordinateSummary } from "../features/trips/trip-coordinates";
import { calculateSampleDistanceKm, isValidDistanceKm } from "../features/trips/trip-distance";
import {
  buildTripHistoryCardModel,
  formatTripDateTime,
  type CompletedTripDisplaySummary,
} from "../features/trips/trip-history-display";
import { getTripMetadataEditStatus, type TripMetadataFeedbackTone } from "../features/trips/trip-metadata-feedback";
import { getTripRouteCoordinates } from "../features/trips/trip-route-map";
import { parseOdometerInput, sanitizeWholeNumberInput, type MobileVehicleOption, type TripPurpose } from "../features/trips/trip-setup";
import { businessUseOptionLabel, businessUseSectionLabel, personalUseOptionLabel } from "../features/trips/trip-setup";
import { useTripState } from "../features/trips/trip-state";
import type { MobileTripSession } from "../features/trips/trip-workflow";
import { getExternalMediaTargetForTrip } from "../features/external-media/helpers";

type TripDetailScreenProps = {
  tripId: string;
  onBack: () => void;
};

export function TripDetailScreen({ tripId, onBack }: TripDetailScreenProps) {
  const { session, supabaseSession } = useAuth();
  const { recentTrips, deleteTrip, updateTripMetadata } = useTripState();
  const [samples, setSamples] = useState<TrackingSampleRecord[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<MobileVehicleOption[]>([]);
  const [vehicleOptionsError, setVehicleOptionsError] = useState<string | null>(null);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [draftPurpose, setDraftPurpose] = useState<TripPurpose>("PRIVATE");
  const [draftPurposeText, setDraftPurposeText] = useState("");
  const [draftVehicleId, setDraftVehicleId] = useState<string | undefined>(undefined);
  const [draftStartOdometer, setDraftStartOdometer] = useState("");
  const [draftEndOdometer, setDraftEndOdometer] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const trip = recentTrips.find((recentTrip) => recentTrip.id === tripId);
  const externalMediaTarget = useMemo(() => (trip ? getExternalMediaTargetForTrip(trip) : null), [trip]);
  const sampleSummary: CompletedTripDisplaySummary = useMemo(() => ({
    distanceKm: trip && isValidDistanceKm(trip.backendDistanceKm) ? trip.backendDistanceKm : calculateSampleDistanceKm(samples),
    coordinates: getTripCoordinateSummary(samples),
  }), [samples, trip]);
  const availableVehicleOptions = useMemo(() => {
    if (!trip?.vehicleId || vehicleOptions.some((vehicle) => vehicle.id === trip.vehicleId)) {
      return vehicleOptions;
    }

    return [
      {
        id: trip.vehicleId,
        name: trip.vehicleName ?? trip.vehicleId,
        vehicleMode: trip.tripMode === "RIDE" ? "RIDE" : "DRIVE",
        enableBusinessSplit: Boolean(trip.tripPurpose),
        isDefault: false,
        defaultUse: "PERSONAL" as const,
        latestOdometer: null,
      },
      ...vehicleOptions,
    ];
  }, [trip?.tripMode, trip?.tripPurpose, trip?.vehicleId, trip?.vehicleName, vehicleOptions]);
  const tripCard = trip ? buildTripHistoryCardModel(trip, sampleSummary) : null;
  const metadataFeedback = trip ? getTripMetadataEditStatus(trip, savingMetadata) : null;

  useEffect(() => {
    let cancelled = false;

    async function loadSamples() {
      const storedSamples = await trackingSampleStore.listSamples(tripId);
      if (cancelled) {
        return;
      }

      if (storedSamples.length > 0 || !trip?.backendTripId || !accessToken) {
        setSamples(storedSamples);
        return;
      }

      setSamples([]);
      const backendRoute = await fetchDrivingLogRoutePreview(trip.backendTripId, accessToken, trip.id);
      if (!cancelled) {
        setSamples(backendRoute?.samples ?? []);
      }
    }

    void loadSamples();

    return () => {
      cancelled = true;
    };
  }, [accessToken, trip?.backendTripId, trip?.id, tripId]);

  useEffect(() => {
    if (!trip) {
      return;
    }

    setDraftPurpose(trip.tripPurpose ?? "PRIVATE");
    setDraftPurposeText(trip.purpose ?? "");
    setDraftVehicleId(trip.vehicleId);
    setDraftStartOdometer(formatOdometerInput(trip.startOdometer));
    setDraftEndOdometer(formatOdometerInput(trip.endOdometer));
    setEditError(null);
  }, [trip]);

  useEffect(() => {
    let cancelled = false;

    async function loadVehicleOptions() {
      if (!accessToken) {
        setVehicleOptions([]);
        return;
      }

      try {
        const vehicles = await fetchMobileVehicleOptions(accessToken);
        if (!cancelled) {
          setVehicleOptions(vehicles);
          setVehicleOptionsError(null);
        }
      } catch (unknownError) {
        if (!cancelled) {
          setVehicleOptionsError(unknownError instanceof Error ? unknownError.message : "Unable to load vehicles.");
        }
      }
    }

    void loadVehicleOptions();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSaveMetadata() {
    if (!trip) {
      return;
    }

    setSavingMetadata(true);
    setEditError(null);
    const selectedVehicle = draftVehicleId ? availableVehicleOptions.find((vehicle) => vehicle.id === draftVehicleId) : undefined;
    const startOdometerDraft = parseOdometerDraft(draftStartOdometer, "Start");
    const endOdometerDraft = parseOdometerDraft(draftEndOdometer, "End");

    if (startOdometerDraft.error) {
      setEditError(startOdometerDraft.error);
      setSavingMetadata(false);
      return;
    }

    if (endOdometerDraft.error) {
      setEditError(endOdometerDraft.error);
      setSavingMetadata(false);
      return;
    }

    const startOdometer = startOdometerDraft.value;
    const endOdometer = endOdometerDraft.value;

    if (
      typeof startOdometer === "number" &&
      typeof endOdometer === "number" &&
      endOdometer < startOdometer
    ) {
      setEditError("End odometer must be greater than or equal to start odometer.");
      setSavingMetadata(false);
      return;
    }

    try {
      await updateTripMetadata(trip.id, {
        tripPurpose: selectedVehicle?.enableBusinessSplit ? draftPurpose : undefined,
        purpose: draftPurposeText.trim() || undefined,
        vehicleId: selectedVehicle?.id,
        vehicleName: selectedVehicle?.name,
        startOdometer,
        endOdometer,
      });
      setEditingMetadata(false);
    } catch (unknownError) {
      setEditError(unknownError instanceof Error ? unknownError.message : "Unable to save trip metadata.");
    } finally {
      setSavingMetadata(false);
    }
  }

  function setSanitizedDraftStartOdometer(value: string) {
    setDraftStartOdometer(sanitizeWholeNumberInput(value));
  }

  function setSanitizedDraftEndOdometer(value: string) {
    setDraftEndOdometer(sanitizeWholeNumberInput(value));
  }

  if (!trip || !tripCard) {
    return (
      <ScreenContainer title="Trip">
        <View style={styles.emptyState}>
          <Text style={styles.body}>This trip is no longer available.</Text>
          <PrimaryActionButton label="Back to trips" onPress={onBack} variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Trip detail">
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to trips</Text>
      </Pressable>

      <TripRoutePreview trip={trip} samples={samples} sampleSummary={sampleSummary} />

      <View style={styles.detailCard}>
        <TripLocationRow
          label="Start"
          title={tripCard.startTitle}
          secondary={tripCard.startSecondary}
          dateTime={formatTripDateTime(trip.startedAt)}
        />
        <View style={styles.divider} />
        <TripLocationRow
          label="Finish"
          title={tripCard.finishTitle}
          secondary={tripCard.finishSecondary}
          dateTime={formatTripDateTime(trip.endedAt)}
        />
      </View>

      <View style={styles.detailCard}>
        <View style={styles.metadataHeader}>
          <Text style={styles.cardTitle}>Trip metadata</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditingMetadata((currentValue) => !currentValue);
              setEditError(null);
              setDraftPurpose(trip.tripPurpose ?? "PRIVATE");
              setDraftPurposeText(trip.purpose ?? "");
              setDraftVehicleId(trip.vehicleId);
              setDraftStartOdometer(formatOdometerInput(trip.startOdometer));
              setDraftEndOdometer(formatOdometerInput(trip.endOdometer));
            }}
            style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
          >
            <Text style={styles.editButtonText}>{editingMetadata ? "Cancel" : "Edit"}</Text>
          </Pressable>
        </View>

        {metadataFeedback ? <MetadataFeedback feedback={metadataFeedback} /> : null}

        {editingMetadata ? (
          <View style={styles.editPanel}>
            {availableVehicleOptions.find((vehicle) => vehicle.id === draftVehicleId)?.enableBusinessSplit ? (
              <>
                <Text style={styles.editLabel}>{businessUseSectionLabel}</Text>
                <View style={styles.chipRow}>
                  <EditChip label={personalUseOptionLabel} selected={draftPurpose === "PRIVATE"} onPress={() => setDraftPurpose("PRIVATE")} />
                  <EditChip label={businessUseOptionLabel} selected={draftPurpose === "BUSINESS"} onPress={() => setDraftPurpose("BUSINESS")} />
                </View>
              </>
            ) : null}

            {trip.tripMode === "WALK" ? (
              <Text style={styles.editWarning}>Walk trips do not use a vehicle or odometer.</Text>
            ) : (
              <>
                <Text style={styles.editLabel}>Vehicle</Text>
                <View style={styles.chipRow}>
                  <EditChip label="No vehicle" selected={!draftVehicleId} onPress={() => setDraftVehicleId(undefined)} />
                  {availableVehicleOptions.map((vehicle) => (
                    <EditChip
                      key={vehicle.id}
                      label={vehicle.name}
                      selected={draftVehicleId === vehicle.id}
                      onPress={() => setDraftVehicleId(vehicle.id)}
                    />
                  ))}
                </View>
                {vehicleOptionsError ? <Text style={styles.editWarning}>{vehicleOptionsError}</Text> : null}
                <Text style={styles.editLabel}>Odometer</Text>
                <View style={styles.odometerGrid}>
                  <View style={styles.odometerField}>
                    <Text style={styles.odometerLabel}>Start</Text>
                    <TextInput
                      keyboardType="numeric"
                      onChangeText={setSanitizedDraftStartOdometer}
                      placeholder="optional"
                      style={styles.odometerInput}
                      value={draftStartOdometer}
                    />
                  </View>
                  <View style={styles.odometerField}>
                    <Text style={styles.odometerLabel}>End</Text>
                    <TextInput
                      keyboardType="numeric"
                      onChangeText={setSanitizedDraftEndOdometer}
                      placeholder="optional"
                      style={styles.odometerInput}
                      value={draftEndOdometer}
                    />
                  </View>
                </View>
              </>
            )}
            <Text style={styles.editLabel}>Trip purpose</Text>
            <TextInput
              onChangeText={setDraftPurposeText}
              placeholder="Client meeting, fuel Gig, personal errand"
              placeholderTextColor="#7b8781"
              style={styles.odometerInput}
              value={draftPurposeText}
            />
            {editError ? <Text style={styles.editError}>{editError}</Text> : null}

            <View style={styles.editActions}>
              <PrimaryActionButton label={savingMetadata ? "Saving" : "Save metadata"} onPress={handleSaveMetadata} disabled={savingMetadata} />
            </View>
          </View>
        ) : (
          <>
            <StatusRow label="Mode" value={formatTripModeLabel(trip.tripMode)} />
            {trip.purpose ? <StatusRow label="Purpose" value={trip.purpose} /> : null}
            {trip.tripPurpose ? <StatusRow label="Business use" value={tripCard.purposeText} /> : null}
            <StatusRow label="Vehicle" value={tripCard.vehicleText} />
          </>
        )}

        <StatusRow label="Start odometer" value={trip.tripMode === "WALK" ? "Not used" : formatOdometer(trip.startOdometer)} />
        <StatusRow label="End odometer" value={trip.tripMode === "WALK" ? "Not used" : formatOdometer(trip.endOdometer)} />
        <StatusRow label="Distance" value={tripCard.distanceText} />
        <StatusRow label="Duration" value={formatDuration(trip.startedAt, trip.endedAt)} />
        <StatusRow label="Saved" value={formatSyncState(trip.syncState)} />
      </View>

      <ExternalMediaSection accessToken={accessToken} target={externalMediaTarget} />

      <View style={styles.actions}>
        <PrimaryActionButton
          label="Delete trip"
          onPress={() => {
            Alert.alert("Delete trip?", "This removes the trip from this device and GigEze.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  await deleteTrip(trip.id);
                  onBack();
                },
              },
            ]);
          }}
          variant="danger"
        />
      </View>
    </ScreenContainer>
  );
}

function TripRoutePreview({
  trip,
  samples,
  sampleSummary,
}: {
  trip: MobileTripSession;
  samples: TrackingSampleRecord[];
  sampleSummary: CompletedTripDisplaySummary;
}) {
  const routeCoordinates = useMemo(() => getTripRouteCoordinates(samples), [samples]);
  const distanceKm = isValidDistanceKm(trip.backendDistanceKm) ? trip.backendDistanceKm : sampleSummary.distanceKm;

  return (
    <TripRouteHero
      routeCoordinates={routeCoordinates}
      overlayLabel="Distance"
      overlayValue={formatDistanceKm(distanceKm, { tripType: getDistanceDisplayTripType(trip.tripMode) })}
      overlayDetail={routeCoordinates.length > 0 ? "Route recorded" : undefined}
      fallbackTitle="Route not available"
      fallbackBody="This trip does not have a route preview."
    />
  );
}

function EditChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.editChip, selected && styles.editChipSelected, pressed && styles.editChipPressed]}
    >
      <Text style={[styles.editChipText, selected && styles.editChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function MetadataFeedback({
  feedback,
}: {
  feedback: {
    label: string;
    detail?: string;
    tone: TripMetadataFeedbackTone;
  };
}) {
  return (
    <View style={[styles.feedback, styles[`feedback_${feedback.tone}`]]}>
      <Text style={[styles.feedbackText, styles[`feedbackText_${feedback.tone}`]]}>{feedback.label}</Text>
      {feedback.detail ? <Text numberOfLines={2} style={styles.feedbackDetail}>{feedback.detail}</Text> : null}
    </View>
  );
}

function formatDuration(startedAt: string, endedAt: string | undefined) {
  if (!endedAt) {
    return "Not available";
  }

  const startedAtMs = new Date(startedAt).getTime();
  const endedAtMs = new Date(endedAt).getTime();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs < startedAtMs) {
    return "Not available";
  }

  const totalMinutes = Math.round((endedAtMs - startedAtMs) / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
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

function formatOdometerInput(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function parseOdometerDraft(value: string, label: string): { value?: number; error?: string } {
  if (!value.trim()) {
    return { value: undefined };
  }

  const parsed = parseOdometerInput(value);
  if (typeof parsed !== "number") {
    return { error: `${label} odometer must be a whole number.` };
  }

  return { value: parsed };
}

function formatSyncState(syncState: MobileTripSession["syncState"]) {
  if (syncState === "synced") {
    return "Saved";
  }

  if (syncState === "pendingSync") {
    return "Waiting to save";
  }

  if (syncState === "syncing") {
    return "Saving";
  }

  if (syncState === "syncFailed") {
    return "Needs retry";
  }

  return "Saved on device";
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingVertical: 6,
  },
  backButtonText: {
    color: "#1d5c49",
    fontSize: 14,
    fontWeight: "900",
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dce2de",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  divider: {
    backgroundColor: "#e5ebe7",
    height: 1,
  },
  cardTitle: {
    color: "#17201c",
    fontSize: 18,
    fontWeight: "900",
  },
  metadataHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  editButton: {
    borderColor: "#bdd0c7",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editButtonPressed: {
    opacity: 0.72,
  },
  editButtonText: {
    color: "#1d5c49",
    fontSize: 13,
    fontWeight: "900",
  },
  editPanel: {
    gap: 10,
  },
  feedback: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedback_neutral: {
    backgroundColor: "#f6faf8",
    borderColor: "#d6e0da",
  },
  feedback_success: {
    backgroundColor: "#e6f1eb",
    borderColor: "#b8d1c4",
  },
  feedback_warning: {
    backgroundColor: "#fbf6e8",
    borderColor: "#e4d5a9",
  },
  feedback_danger: {
    backgroundColor: "#fbebe8",
    borderColor: "#e4b8b0",
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "900",
  },
  feedbackText_neutral: {
    color: "#42534c",
  },
  feedbackText_success: {
    color: "#1d5c49",
  },
  feedbackText_warning: {
    color: "#7b5b17",
  },
  feedbackText_danger: {
    color: "#9d3b32",
  },
  feedbackDetail: {
    color: "#6a7771",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },
  editLabel: {
    color: "#42534c",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  editChip: {
    backgroundColor: "#f7faf8",
    borderColor: "#d6e0da",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  editChipSelected: {
    backgroundColor: "#e4f0e9",
    borderColor: "#1d5c49",
  },
  editChipPressed: {
    opacity: 0.74,
  },
  editChipText: {
    color: "#42534c",
    fontSize: 13,
    fontWeight: "800",
  },
  editChipTextSelected: {
    color: "#1d5c49",
  },
  editWarning: {
    color: "#7b5b17",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  editError: {
    color: "#9d3b32",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  odometerGrid: {
    flexDirection: "row",
    gap: 10,
  },
  odometerField: {
    flex: 1,
    gap: 5,
  },
  odometerLabel: {
    color: "#5d7068",
    fontSize: 12,
    fontWeight: "900",
  },
  odometerInput: {
    borderColor: "#d6e0da",
    borderRadius: 8,
    borderWidth: 1,
    color: "#17201c",
    fontSize: 15,
    fontWeight: "800",
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editActions: {
    marginTop: 2,
  },
  actions: {
    gap: 10,
  },
  emptyState: {
    gap: 12,
  },
  body: {
    color: "#32453d",
    fontSize: 16,
    lineHeight: 23,
  },
});
