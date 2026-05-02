import { formatDistanceKm } from "@gigeze/shared";

type TripType = "walking" | "ride" | "driving";

type DrivingLogSplitDisplayInput = {
  splitEnabled: boolean;
  businessKm: number;
  personalKm: number;
  totalKm: number;
  tripType: TripType;
};

export type DrivingLogSplitDisplay = {
  showDetails: boolean;
  primaryText?: string;
  secondaryText?: string;
  badgeText?: string;
};

export function getDrivingLogSplitDisplay({
  splitEnabled,
  businessKm,
  personalKm,
  totalKm,
  tripType,
}: DrivingLogSplitDisplayInput): DrivingLogSplitDisplay {
  if (!splitEnabled) {
    return { showDetails: false };
  }

  if (businessKm > 0) {
    const businessText = formatDistanceKm(businessKm, { tripType });
    const personalText = formatDistanceKm(personalKm, { tripType });

    return {
      showDetails: true,
      primaryText: `Business: ${businessText}`,
      secondaryText: `Personal: ${personalText}`,
      badgeText: `Business ${businessText} · Personal ${personalText}`,
    };
  }

  if (personalKm > 0 && personalKm >= totalKm) {
    return {
      showDetails: true,
      primaryText: "Personal",
      badgeText: "Personal",
    };
  }

  return { showDetails: false };
}
