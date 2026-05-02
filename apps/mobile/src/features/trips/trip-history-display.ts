import { formatDistanceKm } from "@gigeze/shared";
import type { MobileTripSession } from "./trip-workflow";
import { formatTripCoordinate, getTripCoordinateSummary, type TripCoordinateSummary } from "./trip-coordinates";
import { getCompletedTripDistanceKilometers } from "./trip-distance";

export type CompletedTripDisplaySummary = {
  distanceKm?: number;
  coordinates: TripCoordinateSummary;
};

export type TripHistoryCardModel = {
  trip: MobileTripSession;
  distanceKm?: number;
  distanceText: string;
  durationMinutes: number;
  tripModeText: string;
  purposeText: "Personal" | "Business" | "Trip";
  vehicleText: string;
  startTimeText: string;
  finishTimeText: string;
  startTitle: string;
  finishTitle: string;
  startSecondary: string;
  finishSecondary: string;
};

export type TripDayGroup = {
  key: string;
  heading: string;
  tripCount: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  tripMode?: MobileTripSession["tripMode"];
  trips: TripHistoryCardModel[];
};

export type TripMonthGroup = {
  key: string;
  heading: string;
  tripCount: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  tripMode?: MobileTripSession["tripMode"];
  days: TripDayGroup[];
};

export type TripHistoryPurposeFilter = "ALL" | "PRIVATE" | "BUSINESS";
export type TripHistoryModeFilter = "ALL" | "WALK" | "RIDE" | "DRIVE";

export type TripHistoryFilters = {
  vehicleId?: string;
  tripMode?: TripHistoryModeFilter;
  purpose?: TripHistoryPurposeFilter;
  searchQuery?: string;
};

function safeDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatTripMonthHeading(date: Date) {
  return date.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
}

export function formatTripDayHeading(date: Date) {
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function formatTripTime(value: string | undefined) {
  const date = safeDate(value);
  if (!date) {
    return "--:--";
  }

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTripDateTime(value: string | undefined) {
  const date = safeDate(value);
  if (!date) {
    return "Not available";
  }

  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTripPurpose(purpose: MobileTripSession["tripPurpose"]): TripHistoryCardModel["purposeText"] {
  if (purpose === "BUSINESS") {
    return "Business";
  }

  if (purpose === "PRIVATE") {
    return "Personal";
  }

  return "Trip";
}

function formatTripMode(tripMode: MobileTripSession["tripMode"]) {
  if (tripMode === "WALK") {
    return "Walk";
  }

  if (tripMode === "RIDE") {
    return "Ride";
  }

  return "Drive";
}

function getDistanceDisplayTripType(tripMode: MobileTripSession["tripMode"]) {
  if (tripMode === "WALK") {
    return "walking" as const;
  }

  if (tripMode === "RIDE") {
    return "ride" as const;
  }

  return "driving" as const;
}

export function formatTripHistoryDistance(
  distanceKm: number | null | undefined,
  tripMode?: MobileTripSession["tripMode"],
) {
  return formatDistanceKm(
    distanceKm,
    tripMode ? { tripType: getDistanceDisplayTripType(tripMode) } : undefined,
  );
}

function mergeTripModeForGroup(
  currentTripMode: MobileTripSession["tripMode"] | undefined,
  nextTripMode: MobileTripSession["tripMode"],
) {
  if (!currentTripMode) {
    return nextTripMode;
  }

  return currentTripMode === nextTripMode ? currentTripMode : undefined;
}

function getDisplayLocation(value: string | undefined) {
  return value?.trim() || undefined;
}

function getTripStartTitle(trip: MobileTripSession, coordinates: TripCoordinateSummary) {
  return coordinates.start || getDisplayLocation(trip.startLocation) ? "Start" : "Start not available";
}

function getTripFinishTitle(trip: MobileTripSession, coordinates: TripCoordinateSummary) {
  return coordinates.finish || getDisplayLocation(trip.endLocation) ? "Finish" : "Finish not available";
}

function getTripStartSecondary(trip: MobileTripSession, coordinates: TripCoordinateSummary) {
  return coordinates.start ? formatTripCoordinate(coordinates.start) : (getDisplayLocation(trip.startLocation) ?? "Not available");
}

function getTripFinishSecondary(trip: MobileTripSession, coordinates: TripCoordinateSummary) {
  return coordinates.finish ? formatTripCoordinate(coordinates.finish) : (getDisplayLocation(trip.endLocation) ?? "Not available");
}

function getTripDurationMinutes(trip: MobileTripSession) {
  const startedAtMs = safeDate(trip.startedAt)?.getTime();
  const endedAtMs = safeDate(trip.endedAt)?.getTime();
  if (startedAtMs === undefined || endedAtMs === undefined || endedAtMs < startedAtMs) {
    return 0;
  }

  return Math.max(0, Math.round((endedAtMs - startedAtMs) / (1000 * 60)));
}

function normalizeSearchText(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getSearchFields(trip: MobileTripSession, card: TripHistoryCardModel) {
  return [
    trip.title,
    trip.vehicleName,
    trip.vehicleId,
    trip.journeyTitle,
    trip.journeyId,
    trip.notes,
    card.purposeText,
    card.vehicleText,
    card.startTitle,
    card.finishTitle,
    card.startSecondary,
    card.finishSecondary,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function buildTripHistoryCardModel(
  trip: MobileTripSession,
  sampleSummary?: CompletedTripDisplaySummary,
): TripHistoryCardModel {
  const coordinates = sampleSummary?.coordinates ?? getTripCoordinateSummary([]);
  const distanceKm = getCompletedTripDistanceKilometers(trip, sampleSummary?.distanceKm);

  return {
    trip,
    distanceKm,
    distanceText: formatTripHistoryDistance(distanceKm, trip.tripMode),
    durationMinutes: getTripDurationMinutes(trip),
    tripModeText: formatTripMode(trip.tripMode),
    purposeText: formatTripPurpose(trip.tripPurpose),
    vehicleText: trip.tripMode === "WALK" ? "No vehicle" : (trip.vehicleName ?? trip.vehicleId ?? "Unassigned"),
    startTimeText: formatTripTime(trip.startedAt),
    finishTimeText: formatTripTime(trip.endedAt),
    startTitle: getTripStartTitle(trip, coordinates),
    finishTitle: getTripFinishTitle(trip, coordinates),
    startSecondary: getTripStartSecondary(trip, coordinates),
    finishSecondary: getTripFinishSecondary(trip, coordinates),
  };
}

export function buildTripHistoryGroups(
  trips: MobileTripSession[],
  sampleSummaryByTripId: Record<string, CompletedTripDisplaySummary> = {},
): TripMonthGroup[] {
  const sortedTrips = [...trips].sort((left, right) => {
    const leftTime = safeDate(left.startedAt)?.getTime() ?? 0;
    const rightTime = safeDate(right.startedAt)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
  const groups = new Map<string, TripMonthGroup>();

  for (const trip of sortedTrips) {
    const tripDate = safeDate(trip.startedAt) ?? safeDate(trip.endedAt) ?? new Date(0);
    const monthKey = formatMonthKey(tripDate);
    const dayKey = formatDayKey(tripDate);
    const card = buildTripHistoryCardModel(trip, sampleSummaryByTripId[trip.id]);
    const distanceKm = card.distanceKm ?? 0;
    let monthGroup = groups.get(monthKey);

    if (!monthGroup) {
      monthGroup = {
        key: monthKey,
        heading: formatTripMonthHeading(tripDate),
        tripCount: 0,
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        tripMode: undefined,
        days: [],
      };
      groups.set(monthKey, monthGroup);
    }

    let dayGroup = monthGroup.days.find((day) => day.key === dayKey);
    if (!dayGroup) {
      dayGroup = {
        key: dayKey,
        heading: formatTripDayHeading(tripDate),
        tripCount: 0,
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        tripMode: undefined,
        trips: [],
      };
      monthGroup.days.push(dayGroup);
    }

    monthGroup.tripCount += 1;
    monthGroup.totalDistanceKm += distanceKm;
    monthGroup.totalDurationMinutes += card.durationMinutes;
    monthGroup.tripMode = mergeTripModeForGroup(monthGroup.tripMode, trip.tripMode);
    dayGroup.tripCount += 1;
    dayGroup.totalDistanceKm += distanceKm;
    dayGroup.totalDurationMinutes += card.durationMinutes;
    dayGroup.tripMode = mergeTripModeForGroup(dayGroup.tripMode, trip.tripMode);
    dayGroup.trips.push(card);
  }

  return [...groups.values()];
}

export function filterTripsByVehicle(trips: MobileTripSession[], vehicleId: string | undefined) {
  if (!vehicleId) {
    return trips;
  }

  return trips.filter((trip) => trip.vehicleId === vehicleId);
}

export function filterTripHistoryTrips(
  trips: MobileTripSession[],
  sampleSummaryByTripId: Record<string, CompletedTripDisplaySummary> = {},
  filters: TripHistoryFilters = {},
) {
  const modeFilter = filters.tripMode ?? "ALL";
  const purposeFilter = filters.purpose ?? "ALL";
  const searchQuery = normalizeSearchText(filters.searchQuery);

  return trips.filter((trip) => {
    const card = buildTripHistoryCardModel(trip, sampleSummaryByTripId[trip.id]);

    if (filters.vehicleId && trip.vehicleId !== filters.vehicleId) {
      return false;
    }

    if (modeFilter !== "ALL" && trip.tripMode !== modeFilter) {
      return false;
    }

    if (purposeFilter !== "ALL" && trip.tripPurpose !== purposeFilter) {
      return false;
    }

    if (searchQuery) {
      return getSearchFields(trip, card).some((field) => field.toLowerCase().includes(searchQuery));
    }

    return true;
  });
}

export function hasActiveTripHistoryFilters(filters: TripHistoryFilters = {}) {
  return Boolean(
    filters.vehicleId ||
    (filters.tripMode && filters.tripMode !== "ALL") ||
    (filters.purpose && filters.purpose !== "ALL") ||
    filters.searchQuery?.trim(),
  );
}

export function formatTripDurationSummary(durationMinutes: number) {
  if (durationMinutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min`;
  }

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function hasTripRoutePreview(sampleCount: number, sampleSummary: CompletedTripDisplaySummary) {
  return sampleCount >= 2 && Boolean(sampleSummary.coordinates.start && sampleSummary.coordinates.finish);
}
