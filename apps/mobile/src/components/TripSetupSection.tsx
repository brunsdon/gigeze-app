import type { TripMode } from "@gigeze/shared";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  businessUseOptionLabel,
  businessUseSectionLabel,
  filterVehicleOptionsForTripMode,
  getVehicleEmptyStateMessage,
  isBusinessSplitEnabledForVehicle,
  personalUseOptionLabel,
  type MobileJourneyOption,
  type MobileVehicleOption,
  type TripPurpose,
  type TripSetupState,
} from "../features/trips/trip-setup";

type SelectOption = {
  label: string;
  value?: string;
  detail?: string;
};

type TripSetupSectionProps = {
  setup: TripSetupState;
  vehicleOptions: MobileVehicleOption[];
  journeyOptions: MobileJourneyOption[];
  odometerInput: string;
  vehicleOptionsError?: string | null;
  journeyOptionsError?: string | null;
  onSelectVehicle: (vehicle: MobileVehicleOption | undefined) => void;
  onSelectJourney: (Tour: MobileJourneyOption | undefined) => void;
  onChangeTripMode: (tripMode: TripMode) => void;
  onChangePurpose: (purpose: TripPurpose) => void;
  onChangeOdometer: (value: string) => void;
};

export function TripSetupSection({
  setup,
  vehicleOptions,
  journeyOptions,
  odometerInput,
  vehicleOptionsError,
  journeyOptionsError,
  onSelectVehicle,
  onSelectJourney,
  onChangeTripMode,
  onChangePurpose,
  onChangeOdometer,
}: TripSetupSectionProps) {
  const [openSelect, setOpenSelect] = useState<"vehicle" | "Tour" | null>(null);
  const filteredVehicleOptions = filterVehicleOptionsForTripMode(vehicleOptions, setup.tripMode);
  const selectedVehicle = filteredVehicleOptions.find((vehicle) => vehicle.id === setup.vehicleId);
  const showPurpose = isBusinessSplitEnabledForVehicle(selectedVehicle, setup.tripMode);
  const vehicleSelectOptions: SelectOption[] = [
    { label: "No vehicle", value: undefined },
    ...filteredVehicleOptions.map((vehicle) => ({
      label: vehicle.name,
      value: vehicle.id,
      detail: vehicle.isDefault ? "Default vehicle" : undefined,
    })),
  ];
  const journeySelectOptions: SelectOption[] = [
    { label: "No Tour", value: undefined },
    ...journeyOptions.map((Tour) => ({
      label: Tour.title,
      value: Tour.id,
      detail: Tour.status ? formatJourneyStatus(Tour.status) : undefined,
    })),
  ];

  return (
    <View style={styles.setupPanel}>
      <Text style={styles.setupTitle}>Trip setup</Text>

      <Text style={styles.setupLabel}>Trip mode</Text>
      <View style={styles.segmentedRow}>
        <SegmentButton label="Walk" selected={setup.tripMode === "WALK"} onPress={() => onChangeTripMode("WALK")} />
        <SegmentButton label="Ride" selected={setup.tripMode === "RIDE"} onPress={() => onChangeTripMode("RIDE")} />
        <SegmentButton label="Drive" selected={setup.tripMode === "DRIVE"} onPress={() => onChangeTripMode("DRIVE")} />
      </View>

      {setup.tripMode === "WALK" ? (
        <View style={styles.modeHintCard}>
          <Text style={styles.modeHintTitle}>Walking trip</Text>
          <Text style={styles.modeHintBody}>Vehicle and odometer are skipped for walk trips.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.setupLabel}>Vehicle</Text>
          {filteredVehicleOptions.length > 0 ? (
            <SelectButton
              label={setup.vehicleName ?? "No vehicle"}
              placeholder={!setup.vehicleName}
              onPress={() => setOpenSelect("vehicle")}
            />
          ) : (
            <View style={styles.modeHintCard}>
              <Text style={styles.modeHintTitle}>{getVehicleEmptyStateMessage(setup.tripMode)}</Text>
              <Text style={styles.modeHintBody}>Add one in Vehicles to use it for this trip mode.</Text>
            </View>
          )}
          {vehicleOptionsError ? <Text style={styles.setupWarning}>{vehicleOptionsError}</Text> : null}
        </>
      )}

      <Text style={styles.setupLabel}>Tour</Text>
      <SelectButton
        label={setup.journeyTitle ?? "No Tour"}
        placeholder={!setup.journeyTitle}
        onPress={() => setOpenSelect("Tour")}
      />
      {journeyOptionsError ? <Text style={styles.setupWarning}>{journeyOptionsError}</Text> : null}

      {showPurpose ? (
        <>
          <Text style={styles.setupLabel}>{businessUseSectionLabel}</Text>
          <View style={styles.segmentedRow}>
            <SegmentButton label={personalUseOptionLabel} selected={setup.tripPurpose === "PRIVATE"} onPress={() => onChangePurpose("PRIVATE")} />
            <SegmentButton label={businessUseOptionLabel} selected={setup.tripPurpose === "BUSINESS"} onPress={() => onChangePurpose("BUSINESS")} />
          </View>
        </>
      ) : null}

      {setup.tripMode !== "WALK" ? (
        <>
          <Text style={styles.setupLabel}>Start odometer</Text>
          <TextInput
            keyboardType="numeric"
            onChangeText={onChangeOdometer}
            placeholder="optional"
            style={styles.odometerInput}
            value={odometerInput}
          />
          {setup.vehicleId && !setup.odometerEdited ? (
            <Text style={styles.setupHint}>Using latest odometer for selected vehicle.</Text>
          ) : null}
        </>
      ) : null}

      <SetupSelectModal
        title="Select vehicle"
        visible={openSelect === "vehicle"}
        options={vehicleSelectOptions}
        selectedValue={setup.vehicleId}
        onClose={() => setOpenSelect(null)}
          onSelect={(value) => {
            onSelectVehicle(value ? filteredVehicleOptions.find((vehicle) => vehicle.id === value) : undefined);
            setOpenSelect(null);
          }}
      />
      <SetupSelectModal
        title="Select Tour"
        visible={openSelect === "Tour"}
        options={journeySelectOptions}
        selectedValue={setup.journeyId}
        onClose={() => setOpenSelect(null)}
        onSelect={(value) => {
          onSelectJourney(value ? journeyOptions.find((Tour) => Tour.id === value) : undefined);
          setOpenSelect(null);
        }}
      />
    </View>
  );
}

function SelectButton({ label, placeholder, onPress }: { label: string; placeholder: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} style={[styles.selectText, placeholder && styles.placeholderText]}>{label}</Text>
      <Text style={styles.chevron}>v</Text>
    </Pressable>
  );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.segmentButton, selected && styles.segmentButtonSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SetupSelectModal({
  title,
  visible,
  options,
  selectedValue,
  onClose,
  onSelect,
}: {
  title: string;
  visible: boolean;
  options: SelectOption[];
  selectedValue?: string;
  onClose: () => void;
  onSelect: (value?: string) => void;
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
              const selected = option.value === selectedValue || (!option.value && !selectedValue);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value ?? "none"}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed }) => [styles.optionRow, selected && styles.optionRowSelected, pressed && styles.pressed]}
                >
                  <View style={styles.optionTextGroup}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]} numberOfLines={1}>{option.label}</Text>
                    {option.detail ? <Text style={styles.optionDetail}>{option.detail}</Text> : null}
                  </View>
                  {selected ? <Text style={styles.selectedMark}>Selected</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatJourneyStatus(status: string) {
  return status.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  setupPanel: {
    borderColor: "#d6ded9",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  setupTitle: {
    color: "#1f332d",
    fontSize: 16,
    fontWeight: "900",
  },
  modeHintCard: {
    backgroundColor: "#f5f8f6",
    borderColor: "#d6ded9",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  modeHintTitle: {
    color: "#1f332d",
    fontSize: 14,
    fontWeight: "900",
  },
  modeHintBody: {
    color: "#5d7068",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  setupLabel: {
    color: "#5d7068",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
  },
  selectButton: {
    alignItems: "center",
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectText: {
    color: "#1f332d",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  placeholderText: {
    color: "#5d7068",
  },
  chevron: {
    color: "#5d7068",
    fontSize: 14,
    fontWeight: "900",
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentButtonSelected: {
    backgroundColor: "#1d5c49",
    borderColor: "#1d5c49",
  },
  segmentText: {
    color: "#1d5c49",
    fontSize: 14,
    fontWeight: "800",
  },
  segmentTextSelected: {
    color: "#ffffff",
  },
  odometerInput: {
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#1f332d",
    fontSize: 16,
    fontWeight: "800",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  setupHint: {
    color: "#5d7068",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  setupWarning: {
    color: "#9f3a2f",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.82,
  },
  modalBackdrop: {
    backgroundColor: "rgba(31, 51, 45, 0.38)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fffdfa",
    borderColor: "#d6ded9",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    maxHeight: "70%",
    padding: 12,
  },
  optionScroll: {
    flexShrink: 1,
  },
  optionList: {
    paddingBottom: 8,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalTitle: {
    color: "#1f332d",
    fontSize: 18,
    fontWeight: "900",
  },
  closeButton: {
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  closeText: {
    color: "#1d5c49",
    fontSize: 13,
    fontWeight: "800",
  },
  optionRow: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionRowSelected: {
    backgroundColor: "#e7f3ec",
  },
  optionTextGroup: {
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
  selectedMark: {
    color: "#1d5c49",
    fontSize: 12,
    fontWeight: "900",
  },
});
