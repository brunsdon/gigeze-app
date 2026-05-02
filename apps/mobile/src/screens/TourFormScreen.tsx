import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DatePickerField } from "../components/DatePickerField";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { useAuth } from "../features/auth/auth-context";
import { toDateInputValue } from "../lib/date-display";
import {
  createMobileJourney,
  updateMobileJourney,
  type MobileJourneyInput,
} from "../features/trips/mobile-sync/vehicle-client";
import type { MobileJourneyOption } from "../features/trips/trip-setup";

type JourneyStatus = MobileJourneyInput["status"];
type JourneyVisibility = MobileJourneyInput["visibility"];

type JourneyFormScreenProps = {
  Tour?: MobileJourneyOption | null;
  onCancel: () => void;
  onSaved: () => void;
};

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStatus(value: string | undefined): JourneyStatus {
  return value === "ACTIVE" || value === "COMPLETED" ? value : "PLANNED";
}

function normalizeVisibility(value: string | undefined): JourneyVisibility {
  return value === "SHARED" || value === "PUBLIC" ? value : "PRIVATE";
}

export function TourFormScreen({ Tour, onCancel, onSaved }: JourneyFormScreenProps) {
  const { session, supabaseSession } = useAuth();
  const [title, setTitle] = useState(Tour?.title ?? "");
  const [description, setDescription] = useState(Tour?.description ?? "");
  const [startDate, setStartDate] = useState(() => toDateInputValue(Tour?.startDate));
  const [endDate, setEndDate] = useState(Tour?.endDate ? toDateInputValue(Tour.endDate) : "");
  const [status, setStatus] = useState<JourneyStatus>(normalizeStatus(Tour?.status));
  const [visibility, setVisibility] = useState<JourneyVisibility>(normalizeVisibility(Tour?.visibility));
  const [coverImageUrl, setCoverImageUrl] = useState(Tour?.coverImageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = supabaseSession?.access_token ?? session?.accessToken;
  const editing = Boolean(Tour?.id);

  useEffect(() => {
    setTitle(Tour?.title ?? "");
    setDescription(Tour?.description ?? "");
    setStartDate(toDateInputValue(Tour?.startDate));
    setEndDate(Tour?.endDate ? toDateInputValue(Tour.endDate) : "");
    setStatus(normalizeStatus(Tour?.status));
    setVisibility(normalizeVisibility(Tour?.visibility));
    setCoverImageUrl(Tour?.coverImageUrl ?? "");
    setError(null);
  }, [Tour]);

  function buildInput(): MobileJourneyInput | null {
    if (title.trim().length < 2) {
      setError("Tour name must be at least 2 characters.");
      return null;
    }

    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.getTime())) {
      setError("Start date must be a valid date.");
      return null;
    }

    const trimmedEndDate = endDate.trim();
    if (trimmedEndDate) {
      const parsedEnd = new Date(trimmedEndDate);
      if (Number.isNaN(parsedEnd.getTime())) {
        setError("End date must be a valid date.");
        return null;
      }

      if (parsedEnd < parsedStart) {
        setError("End date cannot be earlier than start date.");
        return null;
      }
    }

    return {
      title: title.trim(),
      description: trimOptional(description),
      startDate: startDate.trim(),
      endDate: trimOptional(endDate),
      status,
      visibility,
      coverImageUrl: trimOptional(coverImageUrl),
    };
  }

  async function saveJourney() {
    const input = buildInput();
    if (!input) {
      return;
    }

    if (!accessToken) {
      setError("Sign in again before saving Tours.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (Tour?.id) {
        await updateMobileJourney(accessToken, Tour.id, input);
      } else {
        await createMobileJourney(accessToken, input);
      }
      onSaved();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Tour could not be saved right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer title={editing ? "Edit Tour" : "Add Tour"}>
      <PrimaryActionButton label="Back to Tours" onPress={onCancel} variant="secondary" />

      <ScreenSection title="Tour details" caption="Use the same Tour fields as the website so trips can link cleanly across mobile and web.">
        <View style={styles.formStack}>
          <LabeledInput label="Name" value={title} onChangeText={setTitle} placeholder="NSW Coast Run" />
          <LabeledInput label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
          <DatePickerField label="Start date" value={startDate} onChange={setStartDate} />
          <DatePickerField label="End date" value={endDate} onChange={setEndDate} placeholder="Optional" optional />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.segmentRow}>
              <SegmentButton label="Planned" selected={status === "PLANNED"} onPress={() => setStatus("PLANNED")} />
              <SegmentButton label="Active" selected={status === "ACTIVE"} onPress={() => setStatus("ACTIVE")} />
              <SegmentButton label="Done" selected={status === "COMPLETED"} onPress={() => setStatus("COMPLETED")} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Visibility</Text>
            <View style={styles.segmentRow}>
              <SegmentButton label="Private" selected={visibility === "PRIVATE"} onPress={() => setVisibility("PRIVATE")} />
              <SegmentButton label="Shared" selected={visibility === "SHARED"} onPress={() => setVisibility("SHARED")} />
              <SegmentButton label="Public" selected={visibility === "PUBLIC"} onPress={() => setVisibility("PUBLIC")} />
            </View>
          </View>

          <LabeledInput label="Cover image URL" value={coverImageUrl} onChangeText={setCoverImageUrl} placeholder="Optional" />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryActionButton label={saving ? "Saving..." : "Save Tour"} onPress={saveJourney} disabled={saving} />
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
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7b8a83"
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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
    color: "#596960",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#17201c",
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
    flexWrap: "wrap",
    gap: 10,
  },
  error: {
    color: "#9f3a2f",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
});
