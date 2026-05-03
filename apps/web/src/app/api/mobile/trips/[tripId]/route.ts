import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteDrivingLog } from "@/features/driving-logs/service";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { getErrorMessage } from "@/lib/utils/app-error";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;
  if (!tripId) {
    return NextResponse.json({ error: "invalid-trip-reference" }, { status: 400 });
  }

  try {
    const deletedTrip = await deleteDrivingLog(tripId, authContext.workspace.id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/logs/driving");
    revalidatePath("/dashboard/tours");

    return NextResponse.json({
      backendTripId: deletedTrip.id,
      deletedAt: deletedTrip.deletedAt ? deletedTrip.deletedAt.toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
