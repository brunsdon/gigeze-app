import { z } from "zod";
import { tripModes } from "../types/trips";

export const startTripRequestSchema = z.object({
  journeyId: z.string().min(1).optional(),
  journeyTitle: z.string().min(1).optional(),
  tripMode: z.enum(tripModes).optional(),
  vehicleId: z.string().min(1).optional(),
  vehicleName: z.string().min(1).optional(),
  tripPurpose: z.enum(["PRIVATE", "BUSINESS"]).optional(),
  startOdometer: z.number().int().nonnegative().optional(),
  endOdometer: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime().optional(),
});

export type StartTripRequestInput = z.infer<typeof startTripRequestSchema>;
