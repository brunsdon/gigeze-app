import { type TripMode, type VehicleMode } from "@gigeze/shared";

export type TripPurpose = "PRIVATE" | "BUSINESS";
export type VehicleDefaultUse = "PERSONAL" | "BUSINESS";

export type MobileVehicleOption = {
  id: string;
  name: string;
  vehicleMode: VehicleMode;
  enableBusinessSplit: boolean;
  registration?: string | null;
  fuelType?: string | null;
  notes?: string | null;
  startingOdometer?: number | null;
  isDefault: boolean;
  defaultUse: VehicleDefaultUse;
  latestOdometer: number | null;
};

export type MobileJourneyOption = {
  id: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  visibility?: string;
  coverImageUrl?: string | null;
};

export type TripSetupState = {
  journeyId?: string;
  journeyTitle?: string;
  tripMode: TripMode;
  vehicleId?: string;
  vehicleName?: string;
  businessSplitEnabled: boolean;
  tripPurpose: TripPurpose;
  startOdometer?: number;
  odometerEdited: boolean;
  purposeEdited: boolean;
};

export const defaultTripPurpose: TripPurpose = "PRIVATE";
export const defaultTripMode: TripMode = "DRIVE";
export const businessUseSectionLabel = "Business use";
export const personalUseOptionLabel = "Personal";
export const businessUseOptionLabel = "Business";

export type RecentTripVehicleUsage = {
  tripMode?: TripMode;
  vehicleId?: string;
  startedAt?: string;
  endedAt?: string;
  updatedAt?: string;
};

export function getTripPurposeFromVehicleDefault(defaultUse: VehicleDefaultUse | null | undefined): TripPurpose {
  return defaultUse === "BUSINESS" ? "BUSINESS" : "PRIVATE";
}

export function isBusinessSplitEnabledForVehicle(
  vehicle: Pick<MobileVehicleOption, "enableBusinessSplit"> | undefined,
  tripMode: TripMode,
) {
  return tripMode !== "WALK" && vehicle?.enableBusinessSplit === true;
}

export function getDefaultVehicleOption(vehicles: MobileVehicleOption[]) {
  return vehicles.find((vehicle) => vehicle.isDefault) ?? vehicles[0];
}

export function isVehicleCompatibleWithTripMode(vehicle: Pick<MobileVehicleOption, "vehicleMode"> | undefined, tripMode: TripMode) {
  if (!vehicle) {
    return false;
  }

  if (tripMode === "WALK") {
    return false;
  }

  return vehicle.vehicleMode === tripMode;
}

export function filterVehicleOptionsForTripMode(vehicles: MobileVehicleOption[], tripMode: TripMode) {
  if (tripMode === "WALK") {
    return [];
  }

  return vehicles.filter((vehicle) => isVehicleCompatibleWithTripMode(vehicle, tripMode));
}

export function getVehicleEmptyStateMessage(tripMode: TripMode) {
  if (tripMode === "RIDE") {
    return "No ride vehicles configured";
  }

  if (tripMode === "DRIVE") {
    return "No drive vehicles configured";
  }

  return undefined;
}

export function getDefaultVehicleOptionForTripMode(vehicles: MobileVehicleOption[], tripMode: TripMode) {
  return getDefaultVehicleOption(filterVehicleOptionsForTripMode(vehicles, tripMode));
}

function getRecentTripVehicleIdForMode(
  tripMode: TripMode,
  vehicles: MobileVehicleOption[],
  recentTrips: RecentTripVehicleUsage[] = [],
) {
  const compatibleVehicleIds = new Set(filterVehicleOptionsForTripMode(vehicles, tripMode).map((vehicle) => vehicle.id));
  if (compatibleVehicleIds.size === 0) {
    return undefined;
  }

  const orderedTrips = [...recentTrips].sort((left, right) => {
    const leftTime = new Date(left.endedAt ?? left.updatedAt ?? left.startedAt ?? 0).getTime();
    const rightTime = new Date(right.endedAt ?? right.updatedAt ?? right.startedAt ?? 0).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });

  return orderedTrips.find((trip) => trip.tripMode === tripMode && trip.vehicleId && compatibleVehicleIds.has(trip.vehicleId))?.vehicleId;
}

export function getBestVehicleOptionForTripMode(
  vehicles: MobileVehicleOption[],
  tripMode: TripMode,
  recentTrips: RecentTripVehicleUsage[] = [],
  currentVehicleId?: string,
) {
  const compatibleVehicles = filterVehicleOptionsForTripMode(vehicles, tripMode);
  if (compatibleVehicles.length === 0) {
    return undefined;
  }

  const currentVehicle = currentVehicleId
    ? compatibleVehicles.find((vehicle) => vehicle.id === currentVehicleId)
    : undefined;
  if (currentVehicle) {
    return currentVehicle;
  }

  const defaultVehicle = compatibleVehicles.find((vehicle) => vehicle.isDefault);
  if (defaultVehicle) {
    return defaultVehicle;
  }

  const recentVehicleId = getRecentTripVehicleIdForMode(tripMode, vehicles, recentTrips);
  if (recentVehicleId) {
    return compatibleVehicles.find((vehicle) => vehicle.id === recentVehicleId) ?? compatibleVehicles[0];
  }

  return compatibleVehicles[0];
}

export function createTripSetupState(
  vehicles: MobileVehicleOption[] = [],
  recentTrips: RecentTripVehicleUsage[] = [],
): TripSetupState {
  const defaultVehicle = getBestVehicleOptionForTripMode(vehicles, defaultTripMode, recentTrips);
  const splitEnabled = isBusinessSplitEnabledForVehicle(defaultVehicle, defaultTripMode);

  return {
    tripMode: defaultTripMode,
    vehicleId: defaultVehicle?.id,
    vehicleName: defaultVehicle?.name,
    businessSplitEnabled: splitEnabled,
    tripPurpose: splitEnabled ? getTripPurposeFromVehicleDefault(defaultVehicle?.defaultUse) : "PRIVATE",
    startOdometer: defaultVehicle?.latestOdometer ?? undefined,
    odometerEdited: false,
    purposeEdited: false,
  };
}

export function applyVehicleToTripSetup(
  currentSetup: TripSetupState,
  vehicle: MobileVehicleOption | undefined,
): TripSetupState {
  if (currentSetup.tripMode === "WALK") {
    return {
      ...currentSetup,
      vehicleId: undefined,
      vehicleName: undefined,
      businessSplitEnabled: false,
      tripPurpose: "PRIVATE" as const,
      startOdometer: undefined,
      purposeEdited: false,
    };
  }

  const splitEnabled = isBusinessSplitEnabledForVehicle(vehicle, currentSetup.tripMode);

  return {
    ...currentSetup,
    vehicleId: vehicle?.id,
    vehicleName: vehicle?.name,
    businessSplitEnabled: splitEnabled,
    tripPurpose: splitEnabled
      ? (currentSetup.purposeEdited ? currentSetup.tripPurpose : getTripPurposeFromVehicleDefault(vehicle?.defaultUse))
      : ("PRIVATE" as const),
    startOdometer: currentSetup.odometerEdited ? currentSetup.startOdometer : (vehicle?.latestOdometer ?? undefined),
    purposeEdited: splitEnabled ? currentSetup.purposeEdited : false,
  };
}

export function applyTripModeToTripSetup(
  currentSetup: TripSetupState,
  tripMode: TripMode,
  vehicles: MobileVehicleOption[] = [],
  recentTrips: RecentTripVehicleUsage[] = [],
): TripSetupState {
  if (tripMode === "WALK") {
    return {
      ...currentSetup,
      tripMode,
      vehicleId: undefined,
      vehicleName: undefined,
      businessSplitEnabled: false,
      tripPurpose: "PRIVATE" as const,
      startOdometer: undefined,
      odometerEdited: false,
      purposeEdited: false,
    };
  }

  if (currentSetup.tripMode === tripMode) {
    return currentSetup;
  }

  const nextVehicle = getBestVehicleOptionForTripMode(vehicles, tripMode, recentTrips, currentSetup.vehicleId);
  const nextSetup = {
    ...currentSetup,
    tripMode,
    odometerEdited: false,
    startOdometer: undefined,
  };

  return {
    ...applyVehicleToTripSetup(nextSetup, nextVehicle),
    tripMode,
  };
}

export function syncTripSetupVehicleSelection(
  currentSetup: TripSetupState,
  vehicles: MobileVehicleOption[] = [],
  recentTrips: RecentTripVehicleUsage[] = [],
) {
  if (currentSetup.tripMode === "WALK") {
    return {
      ...currentSetup,
      vehicleId: undefined,
      vehicleName: undefined,
      businessSplitEnabled: false,
      tripPurpose: "PRIVATE" as const,
      startOdometer: undefined,
      odometerEdited: false,
      purposeEdited: false,
    };
  }

  const nextVehicle = getBestVehicleOptionForTripMode(vehicles, currentSetup.tripMode, recentTrips, currentSetup.vehicleId);
  const selectedVehicleChanged = (nextVehicle?.id ?? undefined) !== currentSetup.vehicleId;
  const nextSetup = selectedVehicleChanged
    ? {
        ...currentSetup,
        vehicleId: undefined,
        vehicleName: undefined,
        startOdometer: undefined,
        odometerEdited: false,
      }
    : currentSetup;

  return applyVehicleToTripSetup(nextSetup, nextVehicle);
}

export function applyJourneyToTripSetup(
  currentSetup: TripSetupState,
  Tour: MobileJourneyOption | undefined,
): TripSetupState {
  return {
    ...currentSetup,
    journeyId: Tour?.id,
    journeyTitle: Tour?.title,
  };
}

export function parseOdometerInput(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

export function sanitizeWholeNumberInput(value: string) {
  return value.replace(/[^\d]/g, "");
}
