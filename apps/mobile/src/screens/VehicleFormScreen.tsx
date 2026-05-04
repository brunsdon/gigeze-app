import type { VehicleMode } from "@gigeze/shared";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { useAuth } from "../features/auth/auth-context";
import {
  createMobileVehicle,
  updateMobileVehicle,
  type MobileVehicleInput,
} from "../features/trips/mobile-sync/vehicle-client";
import { sanitizeWholeNumberInput } from "../features/trips/trip-setup";
import type { MobileVehicleOption, VehicleDefaultUse } from "../features/trips/trip-setup";

type VehicleFormScreenProps = {
  vehicle?: MobileVehicleOption | null;
  onCancel: () => void;
  onSaved: () => void;
};

function getInitialOdometer(vehicle: MobileVehicleOption | null | undefined) {
  const value = vehicle?.startingOdometer ?? vehicle?.latestOdometer;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
}

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function VehicleFormScreen({ vehicle, onCancel, onSaved }: VehicleFormScreenProps) {
  const { session, supabaseSession } = useAuth();
  const [name, setName] = useState(vehicle?.name ?? "");
  const [registration, setRegistration] = useState(vehicle?.registration ?? "");
  const [fuelType, setFuelType] = useState(vehicle?.fuelType ?? "");
  const [notes, setNotes] = useState(vehicle?.notes ?? "");
  const [startingOdometer, setStartingOdometer] = useState(() => getInitialOdometer(vehicle));
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>(vehicle?.vehicleMode ?? "DRIVE");
  const [enableBusinessSplit, setEnableBusinessSplit] = useState(vehicle?.enableBusinessSplit ?? true);
  const [defaultUse, setDefaultUse] = useState<VehicleDefaultUse>(vehicle?.defaultUse ?? "PERSONAL");
  const [isDefault, setIsDefault] = useState(vehicle?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const editing = Boolean(vehicle?.id);
  const odometerValue = useMemo(() => Number(startingOdometer), [startingOdometer]);

  function setSanitizedStartingOdometer(value: string) {
    setStartingOdometer(sanitizeWholeNumberInput(value));
  }

  useEffect(() => {
    setName(vehicle?.name ?? "");
    setRegistration(vehicle?.registration ?? "");
    setFuelType(vehicle?.fuelType ?? "");
    setNotes(vehicle?.notes ?? "");
    setStartingOdometer(getInitialOdometer(vehicle));
    setVehicleMode(vehicle?.vehicleMode ?? "DRIVE");
    setEnableBusinessSplit(vehicle?.enableBusinessSplit ?? true);
    setDefaultUse(vehicle?.defaultUse ?? "PERSONAL");
    setIsDefault(vehicle?.isDefault ?? false);
    setError(null);
  }, [vehicle]);

  function buildInput(): MobileVehicleInput | null {
    if (!name.trim()) {
      setError("Vehicle name is required.");
      return null;
    }

    if (!Number.isFinite(odometerValue) || odometerValue < 0) {
      setError("Starting odometer must be 0 or higher.");
      return null;
    }

    return {
      name: name.trim(),
      vehicleMode,
      enableBusinessSplit,
      registration: trimOptional(registration),
      fuelType: trimOptional(fuelType),
      notes: trimOptional(notes),
      startingOdometer: Math.floor(odometerValue),
      defaultUse,
      isDefault,
    };
  }

  async function saveVehicle() {
    const input = buildInput();
    if (!input) {
      return;
    }

    if (!accessToken) {
      setError("Sign in again before saving vehicles.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (vehicle?.id) {
        await updateMobileVehicle(accessToken, vehicle.id, input);
      } else {
        await createMobileVehicle(accessToken, input);
      }
      onSaved();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Vehicle could not be saved right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer title={editing ? "Edit vehicle" : "Add vehicle"}>
      <PrimaryActionButton label="Back to vehicles" onPress={onCancel} variant="secondary" />

      <ScreenSection title="Vehicle details" caption="Use the same vehicle defaults as the web app for trip setup and driving logs.">
        <View style={styles.formStack}>
          <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="VW Caddy" />
          <LabeledInput label="Registration" value={registration} onChangeText={setRegistration} placeholder="Optional" />
          <LabeledInput label="Fuel type" value={fuelType} onChangeText={setFuelType} placeholder="Optional" />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Vehicle mode</Text>
            <View style={styles.segmentRow}>
              <PurposeButton label="Drive" selected={vehicleMode === "DRIVE"} onPress={() => setVehicleMode("DRIVE")} />
              <PurposeButton label="Ride" selected={vehicleMode === "RIDE"} onPress={() => setVehicleMode("RIDE")} />
            </View>
          </View>
          <LabeledInput
            label="Starting odometer"
            value={startingOdometer}
            onChangeText={setSanitizedStartingOdometer}
            keyboardType="number-pad"
            placeholder="0"
          />

          <View style={styles.fieldGroup}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.label}>Enable business/personal split</Text>
                <Text style={styles.hint}>Turn this off for personal-use vehicles and walk-like ride setups.</Text>
              </View>
              <Switch value={enableBusinessSplit} onValueChange={setEnableBusinessSplit} />
            </View>
          </View>

          {enableBusinessSplit ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Purpose default</Text>
              <View style={styles.segmentRow}>
                <PurposeButton label="Personal" selected={defaultUse === "PERSONAL"} onPress={() => setDefaultUse("PERSONAL")} />
                <PurposeButton label="Business" selected={defaultUse === "BUSINESS"} onPress={() => setDefaultUse("BUSINESS")} />
              </View>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.label}>Default vehicle</Text>
              <Text style={styles.hint}>Auto-selected when starting trips.</Text>
            </View>
            <Switch value={isDefault} onValueChange={setIsDefault} />
          </View>

          <LabeledInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryActionButton label={saving ? "Saving..." : "Save vehicle"} onPress={saveVehicle} disabled={saving} />
        </View>
      </ScreenSection>
    </ScreenContainer>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B8AFC0"
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function PurposeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PrimaryActionButton label={label} onPress={onPress} variant={selected ? "primary" : "secondary"} />
  );
}

const styles = StyleSheet.create({
  formStack: {
    gap: 14,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: "#B8AFC0",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#FFF7EA",
    fontSize: 17,
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 94,
    textAlignVertical: "top",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  switchRow: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  switchCopy: {
    flex: 1,
    gap: 3,
  },
  hint: {
    color: "#B8AFC0",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  error: {
    color: "#FF2E63",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
});
