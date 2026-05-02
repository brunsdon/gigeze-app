import { LogUseType } from "@prisma/client";
import { vehicleModes } from "@gigeze/shared";
import { z } from "zod";

export const vehicleCreateSchema = z.object({
  name: z.string().trim().min(1, "Vehicle name is required").max(100),
  registration: z.string().trim().max(20).optional(),
  fuelType: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
  startingOdometer: z.coerce.number().int().nonnegative(),
  vehicleMode: z.enum(vehicleModes).default("DRIVE"),
  enableBusinessSplit: z.boolean().optional(),
  defaultUse: z.nativeEnum(LogUseType).optional(),
  isDefault: z.boolean().optional(),
});

export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
