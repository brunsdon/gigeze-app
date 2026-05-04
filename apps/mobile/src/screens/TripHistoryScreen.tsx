import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenSection } from "../components/ScreenSection";
import { useAuth } from "../features/auth/auth-context";
import { fetchMobileVehicleOptions } from "../features/trips/mobile-sync/vehicle-client";
import { trackingSampleStore } from "../features/trips/mobile-tracking/sample-store";
import { getTripCoordinateSummary } from "../features/trips/trip-coordinates";
import {
  buildTripHistoryGroups,
  filterTripHistoryTrips,
  formatTripHistoryDistance,
  formatTripDurationSummary,
  hasActiveTripHistoryFilters,
  type CompletedTripDisplaySummary,
  type TripDayGroup,
  type TripHistoryCardModel,
  type TripHistoryModeFilter,
  type TripHistoryPurposeFilter,
  type TripMonthGroup,
} from "../features/trips/trip-history-display";
import { calculateSampleDistanceKm, isValidDistanceKm } from "../features/trips/trip-distance";
import type { MobileVehicleOption } from "../features/trips/trip-setup";
import { useTripState } from "../features/trips/trip-state";
import type { MobileTripSession } from "../features/trips/trip-workflow";

type TripHistoryScreenProps = {
  onSelectTrip?: (tripId: string) => void;
};

type TripMonthSection = TripMonthGroup & {
  data: TripDayGroup[];
};

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export function TripHistoryScreen({ onSelectTrip }: TripHistoryScreenProps) {
  const { session, supabaseSession } = useAuth();
  const { recentTrips, status, error, syncInProgress, pendingUndoDelete, deleteTrip, undoDeleteTrip, syncPendingTrips } = useTripState();
  const [sampleSummaryByTripId, setSampleSummaryByTripId] = useState<Record<string, CompletedTripDisplaySummary>>({});
  const [expandedDayKeys, setExpandedDayKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [modeFilter, setModeFilter] = useState<TripHistoryModeFilter>("ALL");
  const [purposeFilter, setPurposeFilter] = useState<TripHistoryPurposeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [revealedTripId, setRevealedTripId] = useState<string | null>(null);
  const [vehicleOptions, setVehicleOptions] = useState<MobileVehicleOption[]>([]);
  const [vehicleFilterOpen, setVehicleFilterOpen] = useState(false);
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const vehicleFilterOptions = useMemo(
    () => buildVehicleFilterOptions(vehicleOptions, recentTrips),
    [recentTrips, vehicleOptions],
  );
  const filteredTrips = useMemo(
    () => filterTripHistoryTrips(recentTrips, sampleSummaryByTripId, {
      vehicleId: selectedVehicleId,
      tripMode: modeFilter,
      purpose: purposeFilter,
      searchQuery,
    }),
    [modeFilter, purposeFilter, recentTrips, sampleSummaryByTripId, searchQuery, selectedVehicleId],
  );
  const selectedVehicleLabel = vehicleFilterOptions.find((option) => option.id === selectedVehicleId)?.label ?? "All vehicles";
  const tripGroups = useMemo(() => buildTripHistoryGroups(filteredTrips, sampleSummaryByTripId), [filteredTrips, sampleSummaryByTripId]);
  const sections = useMemo<TripMonthSection[]>(() => tripGroups.map((monthGroup) => ({ ...monthGroup, data: monthGroup.days })), [tripGroups]);
  const totalDistanceKm = tripGroups.reduce((total, group) => total + group.totalDistanceKm, 0);
  const hasActiveFilters = hasActiveTripHistoryFilters({
    vehicleId: selectedVehicleId,
    tripMode: modeFilter,
    purpose: purposeFilter,
    searchQuery,
  });
  const pendingSyncCount = getVisibleSyncPendingCount(filteredTrips);
  const syncStatusText = getSyncStatusText({
    syncInProgress,
    pendingCount: pendingSyncCount,
  });

  function clearFilters() {
    setSelectedVehicleId(undefined);
    setModeFilter("ALL");
    setPurposeFilter("ALL");
    setSearchQuery("");
  }

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
        }
      } catch {
        if (!cancelled) {
          setVehicleOptions([]);
        }
      }
    }

    void loadVehicleOptions();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadSampleSummaries() {
      const sampleSummaryEntries = await Promise.all(
        recentTrips.map(async (trip) => {
          const samples = await trackingSampleStore.listSamples(trip.id);
          const distanceKm = isValidDistanceKm(trip.backendDistanceKm) ? trip.backendDistanceKm : calculateSampleDistanceKm(samples);
          return [trip.id, { distanceKm, coordinates: getTripCoordinateSummary(samples) }] as const;
        }),
      );

      if (!cancelled) {
        setSampleSummaryByTripId(Object.fromEntries(sampleSummaryEntries));
      }
    }

    void loadSampleSummaries();

    return () => {
      cancelled = true;
    };
  }, [recentTrips]);

  return (
    <View style={styles.screen}>
      <SectionList<TripDayGroup, TripMonthSection>
        sections={sections}
        keyExtractor={(dayGroup) => dayGroup.key}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <Text style={styles.screenTitle}>Trips</Text>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryText}>{filteredTrips.length} trips · {formatTripHistoryDistance(totalDistanceKm)}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={syncInProgress}
                onPress={async () => {
                  await syncPendingTrips();
                }}
                style={({ pressed }) => [styles.syncStatusChip, pressed && styles.syncStatusChipPressed, syncInProgress && styles.syncStatusChipDisabled]}
              >
                <Text style={styles.syncStatusText}>{syncStatusText}</Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchQuery}
              placeholder="Search trips…"
              placeholderTextColor="#B8AFC0"
              style={styles.searchInput}
              value={searchQuery}
            />

            <View style={styles.filterPanel}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Vehicle</Text>
                <View style={styles.filterButtonRow}>
                  <FilterTriggerChip
                    label={selectedVehicleLabel}
                    selected={Boolean(selectedVehicleId)}
                    onPress={() => setVehicleFilterOpen(true)}
                  />
                  {hasActiveFilters ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={clearFilters}
                      style={({ pressed }) => [styles.clearFiltersChip, pressed && styles.clearFiltersChipPressed]}
                    >
                      <Text style={styles.clearFiltersText}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Mode</Text>
                <View style={styles.chipRow}>
                  <FilterChip label="All" selected={modeFilter === "ALL"} onPress={() => setModeFilter("ALL")} />
                  <FilterChip label="Walk" selected={modeFilter === "WALK"} onPress={() => setModeFilter("WALK")} />
                  <FilterChip label="Ride" selected={modeFilter === "RIDE"} onPress={() => setModeFilter("RIDE")} />
                  <FilterChip label="Drive" selected={modeFilter === "DRIVE"} onPress={() => setModeFilter("DRIVE")} />
                </View>
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Use</Text>
                <View style={styles.chipRow}>
                  <FilterChip label="All" selected={purposeFilter === "ALL"} onPress={() => setPurposeFilter("ALL")} />
                  <FilterChip label="Personal" selected={purposeFilter === "PRIVATE"} onPress={() => setPurposeFilter("PRIVATE")} />
                  <FilterChip label="Business" selected={purposeFilter === "BUSINESS"} onPress={() => setPurposeFilter("BUSINESS")} />
                </View>
              </View>
            </View>

            {pendingUndoDelete ? (
              <View style={styles.undoBanner}>
                <Text numberOfLines={1} style={styles.undoText}>{pendingUndoDelete.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void undoDeleteTrip();
                  }}
                  style={({ pressed }) => [styles.undoButton, pressed && styles.undoButtonPressed]}
                >
                  <Text style={styles.undoButtonText}>UNDO</Text>
                </Pressable>
              </View>
            ) : null}

            {status === "initializing" ? (
              <ScreenSection title="Loading trips">
                <Text style={styles.body}>Restoring local trip history.</Text>
              </ScreenSection>
            ) : null}
            {error ? (
              <ScreenSection title="Trip storage issue">
                <Text style={styles.error}>{error}</Text>
              </ScreenSection>
            ) : null}
          </View>
        )}
        ListEmptyComponent={(
          recentTrips.length === 0 ? (
            <ScreenSection title="No trips yet" caption="Completed trips will appear here after you record them.">
              <Text style={styles.body}>Start and Gig a trip from the Live Trip screen to build your local trip history.</Text>
            </ScreenSection>
          ) : (
            <ScreenSection title="No trips match these filters." caption="Try another search or filter.">
              <Text style={styles.body}>Matching trips will appear here after they are recorded or refreshed.</Text>
              {hasActiveFilters ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={clearFilters}
                  style={({ pressed }) => [styles.emptyStateAction, pressed && styles.emptyStateActionPressed]}
                >
                  <Text style={styles.emptyStateActionText}>Clear filters</Text>
                </Pressable>
              ) : null}
            </ScreenSection>
          )
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.stickyMonthHeader}>
            <Text style={styles.monthTitle}>{section.heading}</Text>
            <Text style={styles.sectionMeta}>
              {section.tripCount} trips · {formatTripHistoryDistance(section.totalDistanceKm, section.tripMode)} · {formatTripDurationSummary(section.totalDurationMinutes)}
            </Text>
          </View>
        )}
        renderItem={({ item: dayGroup }) => {
          const expanded = expandedDayKeys.has(dayGroup.key);
          return (
            <View style={styles.daySection}>
              <DayGroupHeader
                dayGroup={dayGroup}
                expanded={expanded}
                onToggle={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setExpandedDayKeys((currentKeys) => toggleExpandedDay(currentKeys, dayGroup.key));
                }}
              />
              {expanded ? (
                <View style={styles.cardStack}>
                  {dayGroup.trips.map((tripCard) => (
                    <TripHistoryCard
                      key={tripCard.trip.id}
                      tripCard={tripCard}
                      revealed={revealedTripId === tripCard.trip.id}
                      onHide={() => setRevealedTripId(null)}
                      onPress={() => onSelectTrip?.(tripCard.trip.id)}
                      onReveal={() => setRevealedTripId(tripCard.trip.id)}
                      onDelete={() => {
                        setRevealedTripId(null);
                        confirmDeleteTrip(tripCard.trip, deleteTrip);
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />

      <SelectionFilterModal
        title="Filter by vehicle"
        options={vehicleFilterOptions}
        selectedOptionId={selectedVehicleId}
        visible={vehicleFilterOpen}
        onClose={() => setVehicleFilterOpen(false)}
        onSelect={(optionId) => {
          setSelectedVehicleId(optionId);
          setVehicleFilterOpen(false);
        }}
      />
    </View>
  );
}

type FilterOption = {
  id?: string;
  label: string;
  detail?: string;
};

function buildVehicleFilterOptions(vehicles: MobileVehicleOption[], trips: MobileTripSession[]): FilterOption[] {
  const optionMap = new Map<string, FilterOption>();

  for (const vehicle of vehicles) {
    optionMap.set(vehicle.id, {
      id: vehicle.id,
      label: vehicle.name,
      detail: vehicle.isDefault ? "Default vehicle" : undefined,
    });
  }

  for (const trip of trips) {
    if (!trip.vehicleId || optionMap.has(trip.vehicleId)) {
      continue;
    }

    optionMap.set(trip.vehicleId, {
      id: trip.vehicleId,
      label: trip.vehicleName ?? trip.vehicleId,
      detail: "From trip history",
    });
  }

  return [{ label: "All vehicles" }, ...optionMap.values()];
}

function getVisibleSyncPendingCount(trips: MobileTripSession[]) {
  return trips.filter((trip) =>
    trip.syncState === "localOnly" ||
    trip.syncState === "pendingSync" ||
    trip.syncState === "syncing" ||
    trip.syncState === "syncFailed" ||
    trip.deletionSyncState === "pendingDelete" ||
    trip.deletionSyncState === "deleting" ||
    trip.deletionSyncState === "deleteFailed",
  ).length;
}

function getSyncStatusText({ syncInProgress, pendingCount }: { syncInProgress: boolean; pendingCount: number }) {
  if (syncInProgress) {
    return "Saving...";
  }

  if (pendingCount > 0) {
    return pendingCount === 1 ? "1 trip waiting" : `${pendingCount} trips waiting`;
  }

  return "Saved";
}

function toggleExpandedDay(currentKeys: ReadonlySet<string>, dayKey: string) {
  const nextKeys = new Set(currentKeys);
  if (nextKeys.has(dayKey)) {
    nextKeys.delete(dayKey);
  } else {
    nextKeys.add(dayKey);
  }

  return nextKeys;
}

function DayGroupHeader({
  dayGroup,
  expanded,
  onToggle,
}: {
  dayGroup: TripDayGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={({ pressed }) => [styles.dayHeaderButton, pressed && styles.dayHeaderPressed]}
    >
      <View style={styles.dayHeaderCopy}>
        <Text style={styles.dayTitle}>{dayGroup.heading}</Text>
        <Text style={styles.sectionMeta}>
          {dayGroup.tripCount} trips · {formatTripHistoryDistance(dayGroup.totalDistanceKm, dayGroup.tripMode)} · {formatTripDurationSummary(dayGroup.totalDurationMinutes)}
        </Text>
      </View>
      <Text style={styles.dayChevron}>{expanded ? "v" : ">"}</Text>
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.filterChipPressed]}
    >
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function FilterTriggerChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterTriggerChip,
        selected && styles.filterTriggerChipSelected,
        pressed && styles.filterTriggerChipPressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.filterTriggerText, selected && styles.filterTriggerTextSelected]}>
        {label}
      </Text>
      <Text style={[styles.filterTriggerChevron, selected && styles.filterTriggerTextSelected]}>v</Text>
    </Pressable>
  );
}

function SelectionFilterModal({
  title,
  options,
  selectedOptionId,
  visible,
  onClose,
  onSelect,
}: {
  title: string;
  options: FilterOption[];
  selectedOptionId?: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (optionId?: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { paddingBottom: Math.max(insets.bottom + 28, 44), paddingTop: Math.max(insets.top + 16, 24) }]}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.optionList} style={styles.optionScroll}>
            {options.map((option) => {
              const selected = option.id === selectedOptionId || (!option.id && !selectedOptionId);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.id ?? "all"}
                  onPress={() => onSelect(option.id)}
                  style={({ pressed }) => [styles.optionRow, selected && styles.optionRowSelected, pressed && styles.optionRowPressed]}
                >
                  <View style={styles.optionCopy}>
                    <Text numberOfLines={1} style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                    {option.detail ? <Text style={styles.optionDetail}>{option.detail}</Text> : null}
                  </View>
                  {selected ? <Text style={styles.selectedText}>Selected</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function confirmDeleteTrip(trip: MobileTripSession, deleteTrip: (tripId: string) => Promise<MobileTripSession[]>) {
  Alert.alert("Delete trip?", "This removes the trip from this device and GigEze.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        await deleteTrip(trip.id);
      },
    },
  ]);
}

function TripHistoryCard({
  tripCard,
  revealed,
  onHide,
  onPress,
  onReveal,
  onDelete,
}: {
  tripCard: TripHistoryCardModel;
  revealed: boolean;
  onHide: () => void;
  onPress: () => void;
  onReveal: () => void;
  onDelete: () => void;
}) {
  const purposeAccent = tripCard.purposeText === "Business" ? "#5d5b9f" : "#d95c58";
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -36) {
            onReveal();
          } else if (gestureState.dx > 20) {
            onHide();
          }
        },
      }),
    [onHide, onReveal],
  );

  return (
    <View style={styles.swipeShell} {...panResponder.panHandlers}>
      {revealed ? (
        <View style={styles.swipeActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [styles.swipeDeleteAction, pressed && styles.swipeDeleteActionPressed]}
          >
            <Text style={styles.swipeDeleteText}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens trip details. Swipe left to reveal delete."
        onPress={() => {
          if (revealed) {
            onHide();
          } else {
            onPress();
          }
        }}
        style={({ pressed }) => [styles.tripCard, revealed && styles.tripCardRevealed, pressed && styles.tripCardPressed]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.purposeGroup}>
            <View style={[styles.purposeIcon, { backgroundColor: purposeAccent }]} />
          <Text style={styles.purposeText}>{tripCard.tripModeText} · {tripCard.purposeText}</Text>
          </View>
          <Text style={styles.cardDistance}>{tripCard.distanceText}</Text>
        </View>

        <View style={styles.timeline}>
          <TimelineRow time={tripCard.startTimeText} title={tripCard.startTitle} secondary={tripCard.startSecondary} first />
          <TimelineRow time={tripCard.finishTimeText} title={tripCard.finishTitle} secondary={tripCard.finishSecondary} />
        </View>

        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={styles.vehicleText}>{tripCard.vehicleText}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              onPress();
            }}
            style={({ pressed }) => [styles.footerAction, pressed && styles.footerActionPressed]}
          >
            <Text style={styles.footerActionText}>Details</Text>
            <Text style={styles.footerChevron}>›</Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

function TimelineRow({
  time,
  title,
  secondary,
  first = false,
}: {
  time: string;
  title: string;
  secondary: string;
  first?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineTime}>{time}</Text>
      <View style={styles.timelineMarkerColumn}>
        <View style={styles.timelineDot} />
        {first ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.locationTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.locationSecondary}>{secondary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#1E1724",
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: 124,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  listHeader: {
    gap: 14,
  },
  screenTitle: {
    color: "#FFF7EA",
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 45,
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  summaryText: {
    color: "#B8AFC0",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  syncStatusChip: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncStatusChipPressed: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
  },
  syncStatusChipDisabled: {
    opacity: 0.74,
  },
  syncStatusText: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "900",
  },
  searchInput: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#FFF7EA",
    fontSize: 16,
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterPanel: {
    gap: 12,
  },
  filterGroup: {
    gap: 7,
  },
  filterGroupLabel: {
    color: "#B8AFC0",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  filterButtonRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterTriggerChip: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterTriggerChipSelected: {
    backgroundColor: "#FF2E63",
    borderColor: "#FF2E63",
  },
  filterTriggerChipPressed: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
  },
  filterTriggerText: {
    color: "#FFF7EA",
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  filterTriggerTextSelected: {
    color: "#FFF7EA",
  },
  filterTriggerChevron: {
    color: "#B8AFC0",
    fontSize: 12,
    fontWeight: "900",
  },
  clearFiltersChip: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  clearFiltersChipPressed: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
  },
  clearFiltersText: {
    color: "#B8AFC0",
    fontSize: 13,
    fontWeight: "900",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipSelected: {
    backgroundColor: "#FF2E63",
    borderColor: "#FF2E63",
  },
  filterChipPressed: {
    opacity: 0.82,
  },
  filterChipText: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "900",
  },
  filterChipTextSelected: {
    color: "#FFF7EA",
  },
  undoBanner: {
    alignItems: "center",
    backgroundColor: "#1f2925",
    borderRadius: 8,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  undoText: {
    color: "#FFF7EA",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  undoButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  undoButtonPressed: {
    opacity: 0.75,
  },
  undoButtonText: {
    color: "#FFF7EA",
    fontSize: 14,
    fontWeight: "900",
  },
  stickyMonthHeader: {
    backgroundColor: "#1E1724",
    gap: 4,
    paddingBottom: 10,
    paddingTop: 8,
  },
  monthTitle: {
    color: "#FFF7EA",
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 38,
  },
  sectionMeta: {
    color: "#B8AFC0",
    fontSize: 15,
    fontWeight: "800",
  },
  daySection: {
    gap: 10,
  },
  dayHeaderButton: {
    alignItems: "center",
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dayHeaderPressed: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
  },
  dayHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  dayTitle: {
    color: "#FFF7EA",
    fontSize: 18,
    fontWeight: "900",
  },
  dayChevron: {
    color: "#FFB000",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
    minWidth: 24,
    textAlign: "center",
  },
  cardStack: {
    gap: 12,
  },
  sectionSeparator: {
    height: 4,
  },
  modalBackdrop: {
    backgroundColor: "rgba(8, 7, 10, 0.72)",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    maxHeight: "72%",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  modalTitle: {
    color: "#FFF7EA",
    fontSize: 18,
    fontWeight: "900",
  },
  closeButton: {
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "800",
  },
  optionScroll: {
    flexShrink: 1,
  },
  optionList: {
    paddingBottom: 10,
  },
  optionRow: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowSelected: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    borderColor: "#FF2E63",
  },
  optionRowPressed: {
    opacity: 0.82,
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    color: "#FFF7EA",
    fontSize: 15,
    fontWeight: "800",
  },
  optionLabelSelected: {
    color: "#FFB000",
  },
  optionDetail: {
    color: "#B8AFC0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  selectedText: {
    color: "#FFB000",
    fontSize: 12,
    fontWeight: "900",
  },
  emptyStateAction: {
    alignSelf: "flex-start",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  emptyStateActionPressed: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
  },
  emptyStateActionText: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "900",
  },
  swipeShell: {
    position: "relative",
  },
  swipeActions: {
    alignItems: "stretch",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 86,
  },
  swipeDeleteAction: {
    alignItems: "center",
    backgroundColor: "#FF2E63",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  swipeDeleteActionPressed: {
    opacity: 0.84,
  },
  swipeDeleteText: {
    color: "#FFF7EA",
    fontSize: 14,
    fontWeight: "900",
  },
  tripCard: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tripCardRevealed: {
    transform: [{ translateX: -78 }],
  },
  tripCardPressed: {
    elevation: 1,
    opacity: 0.94,
    shadowOpacity: 0.04,
    transform: [{ translateY: 1 }],
  },
  cardHeader: {
    alignItems: "center",
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  purposeGroup: {
    alignItems: "center",
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  purposeIcon: {
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  purposeText: {
    color: "#FFF7EA",
    fontSize: 13,
    fontWeight: "900",
  },
  cardDistance: {
    color: "#FFF7EA",
    fontSize: 20,
    fontWeight: "900",
  },
  timeline: {
    gap: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 40,
  },
  timelineTime: {
    color: "#B8AFC0",
    fontSize: 12,
    fontWeight: "800",
    paddingTop: 4,
    width: 68,
  },
  timelineMarkerColumn: {
    alignItems: "center",
    width: 20,
  },
  timelineDot: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  timelineLine: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    flex: 1,
    marginVertical: 2,
    width: 1,
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
    paddingBottom: 6,
    paddingLeft: 6,
  },
  locationTitle: {
    color: "#FFF7EA",
    fontSize: 15,
    fontWeight: "900",
  },
  locationSecondary: {
    color: "#B8AFC0",
    fontSize: 11,
    fontWeight: "600",
  },
  cardFooter: {
    alignItems: "center",
    backgroundColor: "#1E1724",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  vehicleText: {
    color: "#B8AFC0",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  footerAction: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footerActionPressed: {
    backgroundColor: "rgba(255, 46, 99, 0.18)",
  },
  footerActionText: {
    color: "#B8AFC0",
    fontSize: 12,
    fontWeight: "800",
  },
  footerChevron: {
    color: "#B8AFC0",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 18,
  },
  body: {
    color: "#B8AFC0",
    fontSize: 16,
    lineHeight: 23,
  },
  error: {
    color: "#FF2E63",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
});
