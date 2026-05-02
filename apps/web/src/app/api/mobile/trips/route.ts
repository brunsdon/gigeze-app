import { tripModes } from "@gigeze/shared";
import { NextResponse } from "next/server";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { listMobileDrivingLogSummaries } from "@/features/driving-logs/service";
import { getErrorMessage } from "@/lib/utils/app-error";

function getTripPurpose(businessKm: number, personalKm: number) {
  if (businessKm > 0 && businessKm >= personalKm) {
    return "BUSINESS";
  }

  if (personalKm > 0 || businessKm === 0) {
    return "PRIVATE";
  }

  return undefined;
}

function normalizeTripMode(value: string) {
  return tripModes.includes(value as (typeof tripModes)[number]) ? value : "DRIVE";
}

export async function GET(request: Request) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const trips = await listMobileDrivingLogSummaries(authContext.workspace.id);

    return NextResponse.json({
      trips: trips.map((trip) => {
        const startedAt = trip.startedAt ?? trip.date;
        const endedAt = trip.endedAt ?? startedAt;

        return {
          backendTripId: trip.id,
          journeyId: trip.journeyId,
          journeyTitle: trip.journeyTitle,
          tripMode: normalizeTripMode(trip.tripMode),
          vehicleId: trip.vehicleId,
          vehicleName: trip.vehicleName,
          tripPurpose: getTripPurpose(trip.businessKm, trip.personalKm),
          purpose: trip.purpose,
          date: trip.date.toISOString(),
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          startLocation: trip.startLocation,
          endLocation: trip.endLocation,
          startOdometer: trip.startOdometer,
          endOdometer: trip.endOdometer,
          distanceKm: trip.computedDistanceKm,
          businessKm: trip.businessKm,
          personalKm: trip.personalKm,
          updatedAt: trip.updatedAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
