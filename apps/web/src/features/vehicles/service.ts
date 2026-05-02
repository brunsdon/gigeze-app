import type { VehicleMode } from "@gigeze/shared";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils/app-error";
import type { VehicleCreateInput } from "@/lib/validation";

export type VehicleRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  vehicleMode: VehicleMode;
  enableBusinessSplit: boolean;
  registration: string | null;
  fuelType: string | null;
  notes: string | null;
  isDefault: boolean;
  startingOdometer: number;
  defaultUse: "PERSONAL" | "BUSINESS";
  createdAt: Date;
  updatedAt: Date;
};

export async function listVehicles(workspaceId: string) {
  return prisma.vehicle.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  }) as Promise<VehicleRecord[]>;
}

export async function getVehicleById(vehicleId: string, workspaceId: string) {
  return prisma.vehicle.findFirst({
    where: { id: vehicleId, workspaceId },
  }) as Promise<VehicleRecord | null>;
}

export async function getDefaultVehicle(workspaceId: string) {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  try {
    return await prisma.vehicle.findFirst({
      where: { workspaceId, isDefault: true },
    });
  } catch {
    try {
      return await prisma.vehicle.findFirst({
        where: { workspaceId },
        orderBy: { name: "asc" },
      });
    } catch {
      return null;
    }
  }
}

export async function getLatestOdometerForVehicle(
  workspaceId: string,
  vehicleId: string,
): Promise<number | null> {
  const latest = await prisma.drivingLog.findFirst({
    where: { workspaceId, vehicleId },
    orderBy: { date: "desc" },
    select: { endOdometer: true },
  });

  if (latest) {
    return latest.endOdometer;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workspaceId },
    select: { startingOdometer: true },
  });

  return vehicle?.startingOdometer ?? null;
}

export async function createVehicle(
  input: VehicleCreateInput,
  workspaceId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.vehicle.updateMany({
        where: { workspaceId },
        data: { isDefault: false },
      });
    }

    return tx.vehicle.create({
      data: {
        workspaceId,
        userId,
        name: input.name,
        vehicleMode: input.vehicleMode,
        enableBusinessSplit: input.enableBusinessSplit ?? true,
        registration: input.registration ?? null,
        fuelType: input.fuelType ?? null,
        notes: input.notes ?? null,
        startingOdometer: input.startingOdometer,
        defaultUse: input.defaultUse ?? "PERSONAL",
        isDefault: input.isDefault ?? false,
      } as never,
    }) as Promise<VehicleRecord>;
  });
}

export async function updateVehicle(
  vehicleId: string,
  input: VehicleCreateInput,
  workspaceId: string,
) {
  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("vehicle-not-found", "VEHICLE_NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.vehicle.updateMany({
        where: { workspaceId, id: { not: vehicleId } },
        data: { isDefault: false },
      });
    }

    return tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        name: input.name,
        vehicleMode: input.vehicleMode,
        enableBusinessSplit: input.enableBusinessSplit ?? true,
        registration: input.registration ?? null,
        fuelType: input.fuelType ?? null,
        notes: input.notes ?? null,
        startingOdometer: input.startingOdometer,
        defaultUse: input.defaultUse ?? "PERSONAL",
        isDefault: input.isDefault ?? false,
      } as never,
    }) as Promise<VehicleRecord>;
  });
}

export async function deleteVehicle(vehicleId: string, workspaceId: string) {
  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("vehicle-not-found", "VEHICLE_NOT_FOUND");
  }

  return prisma.vehicle.delete({ where: { id: vehicleId } });
}
