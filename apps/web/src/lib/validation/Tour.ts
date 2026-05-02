import { JourneyStatus, Visibility } from "@prisma/client";
import { z } from "zod";

const journeyBaseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and dashes")
    .optional(),
  description: z.string().trim().max(2000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  status: z.nativeEnum(JourneyStatus).default(JourneyStatus.PLANNED),
  visibility: z.nativeEnum(Visibility).default(Visibility.PRIVATE),
  coverImageUrl: z.url().optional(),
}).superRefine((value, ctx) => {
  if (value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date cannot be earlier than start date",
    });
  }
});

export const journeyCreateSchema = journeyBaseSchema;
export const journeyUpdateSchema = journeyBaseSchema;

export type JourneyCreateInput = z.infer<typeof journeyCreateSchema>;
export type JourneyUpdateInput = z.infer<typeof journeyUpdateSchema>;
