import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { StatusRow } from "../components/StatusRow";
import { useAuth } from "../features/auth/auth-context";
import { formatDateOnlyLabel } from "../lib/date-display";
import { deleteMobileJourney, fetchMobileJourneyOptions } from "../features/trips/mobile-sync/vehicle-client";
import type { MobileJourneyOption } from "../features/trips/trip-setup";

type JourneysScreenProps = {
  onBack: () => void;
  onAddJourney: () => void;
  onEditJourney: (Tour: MobileJourneyOption) => void;
};

function formatJourneyDate(value: string | null | undefined) {
  return formatDateOnlyLabel(value);
}

function formatJourneyStatus(value: string | undefined) {
  if (!value) {
    return "Planned";
  }

  return value.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ToursScreen({ onBack, onAddJourney, onEditJourney }: JourneysScreenProps) {
  const { session, supabaseSession } = useAuth();
  const [Tours, setJourneys] = useState<MobileJourneyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;

  const loadJourneys = useCallback(async () => {
    if (!accessToken) {
      setJourneys([]);
      setError("Sign in again before managing Tours.");
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      setJourneys(await fetchMobileJourneyOptions(accessToken));
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Tour list is unavailable right now.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadJourneys();
  }, [loadJourneys]);

  function confirmDelete(Tour: MobileJourneyOption) {
    Alert.alert(
      "Delete Tour?",
      "Tours linked to trips, work sessions, or media cannot be deleted. This matches the website rules.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!accessToken) {
              setError("Sign in again before deleting Tours.");
              return;
            }

            try {
              await deleteMobileJourney(accessToken, Tour.id);
              await loadJourneys();
            } catch (unknownError) {
              setError(unknownError instanceof Error ? unknownError.message : "Tour could not be deleted right now.");
            }
          },
        },
      ],
    );
  }

  return (
    <ScreenContainer title="Tours">
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>Back to settings</Text>
        </Pressable>
        <PrimaryActionButton label="Add Tour" onPress={onAddJourney} />
      </View>

      {error ? (
        <ScreenSection title="Tour issue">
          <Text style={styles.error}>{error}</Text>
        </ScreenSection>
      ) : null}

      {loading ? (
        <ScreenSection title="Loading Tours">
          <Text style={styles.body}>Checking your Tour list.</Text>
        </ScreenSection>
      ) : Tours.length === 0 ? (
        <ScreenSection title="No Tours yet" caption="Add a Tour to link trips from the Home and Live Trip setup screens.">
          <PrimaryActionButton label="Add Tour" onPress={onAddJourney} variant="secondary" />
        </ScreenSection>
      ) : (
        <View style={styles.cardStack}>
          {Tours.map((Tour) => (
            <View key={Tour.id} style={styles.journeyCard}>
              <View style={styles.journeyHeader}>
                <View style={styles.journeyTitleGroup}>
                  <Text style={styles.journeyName}>{Tour.title}</Text>
                  {Tour.description ? <Text style={styles.description} numberOfLines={2}>{Tour.description}</Text> : null}
                </View>
                <Text style={styles.statusBadge}>{formatJourneyStatus(Tour.status)}</Text>
              </View>

              <StatusRow label="Starts" value={formatJourneyDate(Tour.startDate)} />
              <StatusRow label="Ends" value={formatJourneyDate(Tour.endDate)} />

              <View style={styles.cardActions}>
                <PrimaryActionButton label="Edit" onPress={() => onEditJourney(Tour)} variant="secondary" />
                <PrimaryActionButton label="Delete" onPress={() => confirmDelete(Tour)} variant="danger" />
              </View>
            </View>
          ))}
        </View>
      )}

      <PrimaryActionButton
        label={refreshing ? "Refreshing" : "Refresh Tours"}
        onPress={loadJourneys}
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
    color: "#1d5c49",
    fontSize: 15,
    fontWeight: "900",
  },
  cardStack: {
    gap: 12,
  },
  journeyCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dce2de",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  journeyHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  journeyTitleGroup: {
    flex: 1,
    gap: 6,
  },
  journeyName: {
    color: "#17201c",
    fontSize: 20,
    fontWeight: "900",
  },
  description: {
    color: "#5d7068",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  statusBadge: {
    backgroundColor: "#e1eee6",
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#1d5c49",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
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
