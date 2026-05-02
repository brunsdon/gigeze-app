import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createVehicle, listVehicles, getLatestOdometerForVehicle } from "@/features/vehicles/service";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { getErrorMessage } from "@/lib/utils/app-error";
import { vehicleCreateSchema } from "@/lib/validation";

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

function revalidateVehicleSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/logs/driving");
}

export async function GET(request: Request) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const vehicles = await listVehicles(authContext.workspace.id);
    const vehicleOdometerEntries = await Promise.all(
      vehicles.map(async (vehicle) => [vehicle.id, await getLatestOdometerForVehicle(authContext.workspace.id, vehicle.id)] as const),
    );
    const vehicleOdometerMap = Object.fromEntries(vehicleOdometerEntries);

    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => serializeVehicle(vehicle, vehicleOdometerMap[vehicle.id] ?? null)),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = vehicleCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "vehicle-invalid-input" }, { status: 400 });
  }

  try {
    const vehicle = await createVehicle(parsed.data, authContext.workspace.id, authContext.user.id);
    const latestOdometer = await getLatestOdometerForVehicle(authContext.workspace.id, vehicle.id);

    revalidateVehicleSurfaces();

    return NextResponse.json({ vehicle: serializeVehicle(vehicle, latestOdometer) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
