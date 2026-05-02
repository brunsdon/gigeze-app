import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { useAuth } from "../features/auth/auth-context";
import { useDrivingDisplayPreferences } from "../features/settings/driving-display-preferences";
import { manageDataNavigationItems } from "../features/settings/manage-data-navigation";
import { useAppMetadata } from "../features/settings/use-app-metadata";
import type { MainRouteName } from "../types/navigation";

type SettingsScreenProps = {
  navigate?: (routeName: MainRouteName) => void;
};

type SettingsNavigationRowProps = {
  label: string;
  description: string;
  onPress: () => void;
  isLast?: boolean;
};

export function SettingsDebugScreen({ navigate }: SettingsScreenProps) {
  const {
    preferences: drivingDisplayPreferences,
    loaded: drivingDisplayPreferencesLoaded,
    setKeepScreenOnWhileDriving,
  } = useDrivingDisplayPreferences();
  const { session, signOut } = useAuth();
  const appMetadata = useAppMetadata();

  return (
    <ScreenContainer title="Settings">
      <ScreenSection title="Driving">
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>Keep screen on while driving</Text>
            <Text style={styles.preferenceBody}>Keeps the screen awake while a trip is recording.</Text>
          </View>
          <Switch
            accessibilityLabel="Keep screen on while driving"
            disabled={!drivingDisplayPreferencesLoaded}
            onValueChange={(value) => {
              void setKeepScreenOnWhileDriving(value);
            }}
            value={drivingDisplayPreferences.keepScreenOnWhileDriving}
          />
        </View>
      </ScreenSection>

      <ScreenSection title="Trip setup" caption="Manage the vehicles and Tours you use when recording trips.">
        <View style={styles.navigationList}>
          {manageDataNavigationItems.map((item, index) => (
            <SettingsNavigationRow
              key={item.routeName}
              label={item.label}
              description={item.description}
              onPress={() => navigate?.(item.routeName)}
              isLast={index === manageDataNavigationItems.length - 1}
            />
          ))}
        </View>
      </ScreenSection>

      <ScreenSection title="Troubleshooting" caption="Tools for checking sign-in, tracking, and saving if something feels off.">
        <View style={styles.navigationList}>
          <SettingsNavigationRow
            label="App health"
            description="Check sign-in, location access, tracking, and saving status."
            onPress={() => navigate?.("diagnostics")}
            isLast
          />
        </View>
      </ScreenSection>

      <ScreenSection title="About">
        <AboutRow label="Version" value={formatVersionLabel(appMetadata.appVersion, appMetadata.appBuild)} />
        <AboutRow label="Account" value={session?.user.email ?? session?.user.displayName ?? "Not available"} />
        <Text style={styles.body}>Sign out removes this account from the app on this device.</Text>
        <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </ScreenSection>
    </ScreenContainer>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

function SettingsNavigationRow({ label, description, onPress, isLast = false }: SettingsNavigationRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.navigationRow,
        isLast && styles.navigationLastRow,
        pressed && styles.navigationRowPressed,
      ]}
    >
      <View style={styles.navigationCopy}>
        <Text style={styles.navigationTitle}>{label}</Text>
        <Text style={styles.navigationDescription}>{description}</Text>
      </View>
      <Text style={styles.navigationChevron}>{">"}</Text>
    </Pressable>
  );
}

function formatVersionLabel(version: string, build: string) {
  if (!build || build.toLowerCase() === "unavailable") {
    return version;
  }

  return `${version} build ${build}`;
}

const styles = StyleSheet.create({
  body: {
    color: "#32453d",
    fontSize: 16,
    lineHeight: 23,
  },
  aboutRow: {
    alignItems: "center",
    borderBottomColor: "#edf1ef",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 38,
    paddingVertical: 8,
  },
  aboutLabel: {
    color: "#596960",
    flexShrink: 0,
    fontSize: 15,
    width: 72,
  },
  aboutValue: {
    color: "#17201c",
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  preferenceCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceTitle: {
    color: "#1f332d",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  preferenceBody: {
    color: "#5d7068",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  navigationList: {
    borderColor: "#dce2de",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  navigationRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dce2de",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navigationRowPressed: {
    backgroundColor: "#eef5f0",
  },
  navigationLastRow: {
    borderBottomWidth: 0,
  },
  navigationCopy: {
    flex: 1,
    gap: 3,
  },
  navigationTitle: {
    color: "#1f332d",
    fontSize: 16,
    fontWeight: "900",
  },
  navigationDescription: {
    color: "#5d7068",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  navigationChevron: {
    color: "#1d5c49",
    fontSize: 26,
    fontWeight: "900",
  },
  signOutButton: {
    alignItems: "center",
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signOutLabel: {
    color: "#1d5c49",
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.82,
  },
});
