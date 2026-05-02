import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteVehicle, getLatestOdometerForVehicle, updateVehicle } from "@/features/vehicles/service";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { getErrorMessage } from "@/lib/utils/app-error";
import { vehicleCreateSchema } from "@/lib/validation";

function revalidateVehicleSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/logs/driving");
}

function serializeVehicle(vehicle: {
  id: string;
  name: string;
  vehicleMode: string;
  enableBusinessSplit: boolean;
  registration: string | null;
  fuelType: string | null;
  notes: string | null;
  startingOdometer: number;
  isDefault: boolean;
  defaultUse: unknown;
}, latestOdometer: number | null) {
  return {
    id: vehicle.id,
    name: vehicle.name,
    vehicleMode: vehicle.vehicleMode,
    enableBusinessSplit: vehicle.enableBusinessSplit,
    registration: vehicle.registration,
    fuelType: vehicle.fuelType,
    notes: vehicle.notes,
    startingOdometer: vehicle.startingOdometer,
    isDefault: vehicle.isDefault,
    defaultUse: vehicle.defaultUse,
    latestOdometer,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { vehicleId } = await params;
  if (!vehicleId) {
    return NextResponse.json({ error: "invalid-vehicle-reference" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = vehicleCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "vehicle-invalid-input" }, { status: 400 });
  }

  try {
    const vehicle = await updateVehicle(vehicleId, parsed.data, authContext.workspace.id);
    const latestOdometer = await getLatestOdometerForVehicle(authContext.workspace.id, vehicle.id);

    revalidateVehicleSurfaces();

    return NextResponse.json({ vehicle: serializeVehicle(vehicle, latestOdometer) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { vehicleId } = await params;
  if (!vehicleId) {
    return NextResponse.json({ error: "invalid-vehicle-reference" }, { status: 400 });
  }

  try {
    const vehicle = await deleteVehicle(vehicleId, authContext.workspace.id);

    revalidateVehicleSurfaces();

    return NextResponse.json({ vehicleId: vehicle.id, deleted: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
