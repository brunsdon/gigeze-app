import { SafeAreaView, StyleSheet, Text, Pressable, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../features/auth/auth-context";
import type { MainRouteName } from "../types/navigation";
import { DiagnosticsScreen } from "../screens/DiagnosticsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { TourFormScreen } from "../screens/TourFormScreen";
import { ToursScreen } from "../screens/ToursScreen";
import { LiveTripScreen } from "../screens/TripScreen";
import { SettingsDebugScreen } from "../screens/SettingsDebugScreen";
import { SignInScreen } from "../screens/SignInScreen";
import { TripDetailScreen } from "../screens/TripDetailScreen";
import { TripHistoryScreen } from "../screens/TripHistoryScreen";
import { VehicleFormScreen } from "../screens/VehicleFormScreen";
import { VehiclesScreen } from "../screens/VehiclesScreen";
import type { MobileJourneyOption, MobileVehicleOption } from "../features/trips/trip-setup";
import { colors, radii } from "../theme";

const mainRoutes: { name: MainRouteName; label: string }[] = [
  { name: "home", label: "Home" },
  { name: "liveTrip", label: "Live Trip" },
  { name: "tripHistory", label: "Trips" },
  { name: "settingsDebug", label: "Settings" },
];

function isRouteActive(activeRoute: MainRouteName, routeName: MainRouteName) {
  if (activeRoute === routeName) {
    return true;
  }

  if (routeName === "tripHistory") {
    return activeRoute === "tripDetail";
  }

  if (routeName === "settingsDebug") {
    return ["diagnostics", "vehicles", "vehicleForm", "Tours", "journeyForm"].includes(activeRoute);
  }

  return false;
}

export function AppNavigator() {
  const { status } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<MainRouteName>("home");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<MobileVehicleOption | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<MobileJourneyOption | null>(null);

  if (status !== "signedIn") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <SignInScreen isLoading={status === "loading"} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.main}>
        {activeRoute === "home" ? <HomeScreen navigate={setActiveRoute} /> : null}
        {activeRoute === "liveTrip" ? <LiveTripScreen /> : null}
        {activeRoute === "tripHistory" ? (
          <TripHistoryScreen
            onSelectTrip={(tripId) => {
              setSelectedTripId(tripId);
              setActiveRoute("tripDetail");
            }}
          />
        ) : null}
        {activeRoute === "tripDetail" && selectedTripId ? (
          <TripDetailScreen
            tripId={selectedTripId}
            onBack={() => {
              setActiveRoute("tripHistory");
            }}
          />
        ) : null}
        {activeRoute === "settingsDebug" ? <SettingsDebugScreen navigate={setActiveRoute} /> : null}
        {activeRoute === "diagnostics" ? <DiagnosticsScreen onBack={() => setActiveRoute("settingsDebug")} /> : null}
        {activeRoute === "vehicles" ? (
          <VehiclesScreen
            onBack={() => setActiveRoute("settingsDebug")}
            onAddVehicle={() => {
              setSelectedVehicle(null);
              setActiveRoute("vehicleForm");
            }}
            onEditVehicle={(vehicle) => {
              setSelectedVehicle(vehicle);
              setActiveRoute("vehicleForm");
            }}
          />
        ) : null}
        {activeRoute === "vehicleForm" ? (
          <VehicleFormScreen
            vehicle={selectedVehicle}
            onCancel={() => setActiveRoute("vehicles")}
            onSaved={() => setActiveRoute("vehicles")}
          />
        ) : null}
        {activeRoute === "Tours" ? (
          <ToursScreen
            onBack={() => setActiveRoute("settingsDebug")}
            onAddJourney={() => {
              setSelectedJourney(null);
              setActiveRoute("journeyForm");
            }}
            onEditJourney={(Tour) => {
              setSelectedJourney(Tour);
              setActiveRoute("journeyForm");
            }}
          />
        ) : null}
        {activeRoute === "journeyForm" ? (
          <TourFormScreen
            Tour={selectedJourney}
            onCancel={() => setActiveRoute("Tours")}
            onSaved={() => setActiveRoute("Tours")}
          />
        ) : null}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
        {mainRoutes.map((route) => {
          const isActive = isRouteActive(activeRoute, route.name);
          return (
            <Pressable
              key={route.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveRoute(route.name)}
              style={[styles.tab, isActive && styles.activeTab]}
            >
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{route.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  main: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: colors.surfaceSubtle,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  tab: {
    alignItems: "center",
    borderRadius: radii.md,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  activeTabLabel: {
    color: colors.white,
  },
});
