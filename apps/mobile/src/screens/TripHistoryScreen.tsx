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
              placeholderTextColor="#7b8a83"
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
    backgroundColor: "#fffdfa",
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
    color: "#17201c",
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
    color: "#596960",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  syncStatusChip: {
    alignItems: "center",
    borderColor: "#c9d4ce",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncStatusChipPressed: {
    backgroundColor: "#eef5f0",
  },
  syncStatusChipDisabled: {
    opacity: 0.74,
  },
  syncStatusText: {
    color: "#1d5c49",
    fontSize: 13,
    fontWeight: "900",
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c9d4ce",
    borderRadius: 8,
    borderWidth: 1,
    color: "#17201c",
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
    color: "#61736b",
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
    borderColor: "#b7c7c0",
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
    backgroundColor: "#1d5c49",
    borderColor: "#1d5c49",
  },
  filterTriggerChipPressed: {
    backgroundColor: "#eef5f0",
  },
  filterTriggerText: {
    color: "#1f332d",
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  filterTriggerTextSelected: {
    color: "#fffdfa",
  },
  filterTriggerChevron: {
    color: "#5d7068",
    fontSize: 12,
    fontWeight: "900",
  },
  clearFiltersChip: {
    alignItems: "center",
    borderColor: "#d6ded9",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  clearFiltersChipPressed: {
    backgroundColor: "#eef5f0",
  },
  clearFiltersText: {
    color: "#5d7068",
    fontSize: 13,
    fontWeight: "900",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderColor: "#b7c7c0",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipSelected: {
    backgroundColor: "#155c49",
    borderColor: "#155c49",
  },
  filterChipPressed: {
    opacity: 0.82,
  },
  filterChipText: {
    color: "#1d5c49",
    fontSize: 13,
    fontWeight: "900",
  },
  filterChipTextSelected: {
    color: "#fffdfa",
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
    color: "#f5fbf8",
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
    color: "#f8c16d",
    fontSize: 14,
    fontWeight: "900",
  },
  stickyMonthHeader: {
    backgroundColor: "#fffdfa",
    gap: 4,
    paddingBottom: 10,
    paddingTop: 8,
  },
  monthTitle: {
    color: "#17201c",
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 38,
  },
  sectionMeta: {
    color: "#6a7771",
    fontSize: 15,
    fontWeight: "800",
  },
  daySection: {
    gap: 10,
  },
  dayHeaderButton: {
    alignItems: "center",
    backgroundColor: "#fbfcf8",
    borderColor: "#e8eee9",
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
    backgroundColor: "#f2f7f3",
  },
  dayHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  dayTitle: {
    color: "#17201c",
    fontSize: 18,
    fontWeight: "900",
  },
  dayChevron: {
    color: "#1d5c49",
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
    backgroundColor: "rgba(31, 51, 45, 0.38)",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#fffdfa",
    borderColor: "#d6ded9",
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
    color: "#1f332d",
    fontSize: 18,
    fontWeight: "900",
  },
  closeButton: {
    borderColor: "#b7c7c0",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: {
    color: "#1d5c49",
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
    borderColor: "#e4ebe6",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowSelected: {
    backgroundColor: "#e7f3ec",
    borderColor: "#1d5c49",
  },
  optionRowPressed: {
    opacity: 0.82,
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    color: "#1f332d",
    fontSize: 15,
    fontWeight: "800",
  },
  optionLabelSelected: {
    color: "#1d5c49",
  },
  optionDetail: {
    color: "#5d7068",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  selectedText: {
    color: "#1d5c49",
    fontSize: 12,
    fontWeight: "900",
  },
  emptyStateAction: {
    alignSelf: "flex-start",
    borderColor: "#b7c7c0",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  emptyStateActionPressed: {
    backgroundColor: "#eef5f0",
  },
  emptyStateActionText: {
    color: "#1d5c49",
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
    backgroundColor: "#a73b34",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  swipeDeleteActionPressed: {
    opacity: 0.84,
  },
  swipeDeleteText: {
    color: "#fffdfa",
    fontSize: 14,
    fontWeight: "900",
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dce2de",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    overflow: "hidden",
    shadowColor: "#17201c",
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
    borderBottomColor: "#e5ebe7",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  purposeGroup: {
    alignItems: "center",
    backgroundColor: "#fbfaf7",
    borderColor: "#efe9df",
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
    color: "#1f332d",
    fontSize: 13,
    fontWeight: "900",
  },
  cardDistance: {
    color: "#17201c",
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
    color: "#6a7771",
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
    backgroundColor: "#ffffff",
    borderColor: "#65736d",
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  timelineLine: {
    backgroundColor: "#d7dfd9",
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
    color: "#17201c",
    fontSize: 15,
    fontWeight: "900",
  },
  locationSecondary: {
    color: "#8b9791",
    fontSize: 11,
    fontWeight: "600",
  },
  cardFooter: {
    alignItems: "center",
    backgroundColor: "#f7f8f4",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  vehicleText: {
    color: "#42534c",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  footerAction: {
    alignItems: "center",
    borderColor: "#dbe4de",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footerActionPressed: {
    backgroundColor: "#eef5f0",
  },
  footerActionText: {
    color: "#7b8a83",
    fontSize: 12,
    fontWeight: "800",
  },
  footerChevron: {
    color: "#7b8a83",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 18,
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
});
