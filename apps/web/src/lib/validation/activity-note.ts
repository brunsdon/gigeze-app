import { ActivityType, Visibility } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

export const activityNoteCreateSchema = z.object({
  journeyId: z.string().min(1),
  stopId: optionalId,
  type: z.nativeEnum(ActivityType),
  date: z.coerce.date(),
  durationMinutes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive("Duration must be greater than zero").optional(),
  ),
  location: optionalText(200),
  notes: optionalText(2000),
  visibility: z.nativeEnum(Visibility).default(Visibility.PRIVATE),
});

export type ActivityNoteCreateInput = z.infer<typeof activityNoteCreateSchema>;
