import { type TripSample } from "@/features/trips/tracking";
import { getAppPersistenceProvider } from "@/features/mobile/persistence";

export const TRIP_SESSION_EVENT = "gigeze-trip-updated";

export type TripSessionState = {
  id: string;
  workspaceId: string;
  journeyId?: string;
  journeySlug?: string;
  journeyTitle?: string;
  startedAt: string;
  lastSampleAt: string;
  totalDistanceKm: number;
  samples: TripSample[];
  geolocationDenied?: boolean;
  geolocationUnavailable?: boolean;
  hiddenAt?: string | null;
  hadTrackingGap?: boolean;
  lastBackgroundDurationMs?: number | null;
  lastVisibilityResumeAt?: string | null;
};

function getStorageKey(workspaceId: string) {
  return `gigeze.trip-session.v1:${workspaceId}`;
}

export function readTripSession(workspaceId: string) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return null;
  }

  const raw = persistence.getItem(getStorageKey(workspaceId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TripSessionState;
    if (!parsed || parsed.workspaceId !== workspaceId || !Array.isArray(parsed.samples)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeTripSession(workspaceId: string, session: TripSessionState) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return;
  }

  persistence.setItem(getStorageKey(workspaceId), JSON.stringify(session));
  persistence.emit(TRIP_SESSION_EVENT);
}

export function clearTripSession(workspaceId: string) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return;
  }

  persistence.removeItem(getStorageKey(workspaceId));
  persistence.emit(TRIP_SESSION_EVENT);
}
