import { NextResponse } from "next/server";
import { listDeletedDrivingLogs } from "@/features/driving-logs/service";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { getErrorMessage } from "@/lib/utils/app-error";

export async function GET(request: Request) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const deletedTrips = await listDeletedDrivingLogs(authContext.workspace.id);

    return NextResponse.json({
      deletedTrips: deletedTrips.map((trip) => ({
        backendTripId: trip.id,
        deletedAt: trip.deletedAt.toISOString(),
        updatedAt: trip.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
