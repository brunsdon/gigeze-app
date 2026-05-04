import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { StatusRow } from "../components/StatusRow";
import { useAuth } from "../features/auth/auth-context";
import { deleteMobileVehicle, fetchMobileVehicleOptions } from "../features/trips/mobile-sync/vehicle-client";
import type { MobileVehicleOption } from "../features/trips/trip-setup";

type VehiclesScreenProps = {
  onBack: () => void;
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: MobileVehicleOption) => void;
};

function formatDefaultUse(defaultUse: MobileVehicleOption["defaultUse"]) {
  return defaultUse === "BUSINESS" ? "Business" : "Personal";
}

function formatVehicleMode(vehicleMode: MobileVehicleOption["vehicleMode"]) {
  return vehicleMode === "RIDE" ? "Ride" : "Drive";
}

function formatOdometer(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString()} km` : "Not recorded";
}

export function VehiclesScreen({ onBack, onAddVehicle, onEditVehicle }: VehiclesScreenProps) {
  const { session, supabaseSession } = useAuth();
  const [vehicles, setVehicles] = useState<MobileVehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;

  const loadVehicles = useCallback(async () => {
    if (!accessToken) {
      setVehicles([]);
      setError("Sign in again before managing vehicles.");
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      setVehicles(await fetchMobileVehicleOptions(accessToken));
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Vehicle list is unavailable right now.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  function confirmDelete(vehicle: MobileVehicleOption) {
    Alert.alert(
      "Delete vehicle?",
      "This removes the vehicle. Existing trips stay in place, but the vehicle link may be cleared on the website.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!accessToken) {
              setError("Sign in again before deleting vehicles.");
              return;
            }

            try {
              await deleteMobileVehicle(accessToken, vehicle.id);
              await loadVehicles();
            } catch (unknownError) {
              setError(unknownError instanceof Error ? unknownError.message : "Vehicle could not be deleted right now.");
            }
          },
        },
      ],
    );
  }

  return (
    <ScreenContainer title="Vehicles">
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>Back to settings</Text>
        </Pressable>
        <PrimaryActionButton label="Add vehicle" onPress={onAddVehicle} />
      </View>

      {error ? (
        <ScreenSection title="Vehicle issue">
          <Text style={styles.error}>{error}</Text>
        </ScreenSection>
      ) : null}

      {loading ? (
        <ScreenSection title="Loading vehicles">
          <Text style={styles.body}>Checking your vehicle list.</Text>
        </ScreenSection>
      ) : vehicles.length === 0 ? (
        <ScreenSection title="No vehicles yet" caption="Add your first vehicle to use defaults in trip setup and trip details.">
          <PrimaryActionButton label="Add vehicle" onPress={onAddVehicle} variant="secondary" />
        </ScreenSection>
      ) : (
        <View style={styles.cardStack}>
          {vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <View style={styles.vehicleTitleGroup}>
                  <Text style={styles.vehicleName}>{vehicle.name}</Text>
                  {vehicle.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
                </View>
                <Text style={styles.vehicleUse}>{formatDefaultUse(vehicle.defaultUse)}</Text>
              </View>

              <StatusRow label="Latest odometer" value={formatOdometer(vehicle.latestOdometer ?? vehicle.startingOdometer)} />
              <StatusRow label="Trip mode" value={formatVehicleMode(vehicle.vehicleMode)} />
              {vehicle.registration ? <StatusRow label="Registration" value={vehicle.registration} /> : null}
              {vehicle.fuelType ? <StatusRow label="Fuel" value={vehicle.fuelType} /> : null}

              <View style={styles.cardActions}>
                <PrimaryActionButton label="Edit" onPress={() => onEditVehicle(vehicle)} variant="secondary" />
                <PrimaryActionButton label="Delete" onPress={() => confirmDelete(vehicle)} variant="danger" />
              </View>
            </View>
          ))}
        </View>
      )}

      <PrimaryActionButton
        label={refreshing ? "Refreshing" : "Refresh vehicles"}
        onPress={loadVehicles}
        variant="secondary"
        disabled={refreshing}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  textButton: {
    borderRadius: 8,
    paddingVertical: 10,
  },
  textButtonLabel: {
    color: "#FFB000",
    fontSize: 15,
    fontWeight: "900",
  },
  cardStack: {
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  vehicleHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  vehicleTitleGroup: {
    flex: 1,
    gap: 6,
  },
  vehicleName: {
    color: "#FFF7EA",
    fontSize: 20,
    fontWeight: "900",
  },
  defaultBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 46, 99, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#FFB000",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  vehicleUse: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
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
