export type TripSessionStatus = "idle" | "active" | "paused" | "completed";
export type TripPurpose = "PRIVATE" | "BUSINESS";
export const tripModes = ["WALK", "RIDE", "DRIVE"] as const;
export type TripMode = (typeof tripModes)[number];
export const vehicleModes = ["RIDE", "DRIVE"] as const;
export type VehicleMode = (typeof vehicleModes)[number];

export type TripSession = {
  id: string;
  userId: string;
  journeyId?: string;
  journeyTitle?: string;
  tripMode?: TripMode;
  vehicleId?: string;
  vehicleName?: string;
  tripPurpose?: TripPurpose;
  startOdometer?: number;
  endOdometer?: number;
  status: TripSessionStatus;
  startedAt: string;
  endedAt?: string;
  distanceMeters?: number;
  notes?: string;
};

export type TripSummary = {
  sessionId: string;
  status: TripSessionStatus;
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  distanceKilometers?: number;
};

export type StartTripRequest = {
  journeyId?: string;
  journeyTitle?: string;
  tripMode?: TripMode;
  vehicleId?: string;
  vehicleName?: string;
  tripPurpose?: TripPurpose;
  startOdometer?: number;
  endOdometer?: number;
  startedAt?: string;
};

export type StartTripResponse = {
  session: TripSession;
};
