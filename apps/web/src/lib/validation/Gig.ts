import { Visibility } from "@prisma/client";
import { z } from "zod";

const stopBaseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  latitude: z.coerce.number().gte(-90).lte(90),
  longitude: z.coerce.number().gte(-180).lte(180),
  locationName: z.string().trim().max(200).optional(),
  arrivalDate: z.coerce.date().optional(),
  departureDate: z.coerce.date().optional(),
  visibility: z.nativeEnum(Visibility).default(Visibility.PRIVATE),
  orderIndex: z.coerce.number().int().positive().default(1),
}).superRefine((value, ctx) => {
  if (value.arrivalDate && value.departureDate && value.departureDate < value.arrivalDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departureDate"],
      message: "Departure date cannot be earlier than arrival date",
    });
  }
});

export const stopCreateSchema = stopBaseSchema.extend({
  journeyId: z.string().min(1),
});

export const stopUpdateSchema = stopBaseSchema.extend({
  journeyId: z.string().min(1),
});

export type StopCreateInput = z.infer<typeof stopCreateSchema>;
export type StopUpdateInput = z.infer<typeof stopUpdateSchema>;
