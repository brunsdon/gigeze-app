import type { MobileTripSession } from "./trip-workflow";

export type TripMetadataFeedbackTone = "neutral" | "success" | "warning" | "danger";

export type TripMetadataFeedback = {
  label: string;
  detail?: string;
  tone: TripMetadataFeedbackTone;
};

type TripMetadataFeedbackInput = Pick<
  MobileTripSession,
  "backendTripId" | "deletedAt" | "lastSyncError" | "lastSyncSucceededAt" | "syncState"
>;

export function getTripMetadataEditStatus(
  trip: TripMetadataFeedbackInput,
  savingLocally: boolean,
): TripMetadataFeedback | null {
  if (trip.deletedAt) {
    return null;
  }

  if (savingLocally) {
    return {
      label: "Saving locally...",
      tone: "neutral",
    };
  }

  if (trip.syncState === "syncFailed") {
    return {
      label: "Sync failed · Will retry",
      detail: trip.lastSyncError,
      tone: "danger",
    };
  }

  if (trip.syncState === "pendingSync" || trip.syncState === "localOnly") {
    return {
      label: "Saved locally · Pending sync",
      tone: "warning",
    };
  }

  if (trip.syncState === "syncing") {
    return {
      label: "Saved locally · Syncing",
      tone: "neutral",
    };
  }

  if (trip.syncState === "synced" && (trip.backendTripId || trip.lastSyncSucceededAt)) {
    return {
      label: "Synced",
      tone: "success",
    };
  }

  return null;
}
