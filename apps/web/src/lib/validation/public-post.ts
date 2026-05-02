import { Visibility } from "@prisma/client";
import { z } from "zod";

export const publicPostStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

const publicPostBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/[a-z0-9]/i, "Title must include at least one letter or number"),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and dashes")
    .optional(),
  excerpt: z.string().trim().max(320).optional(),
  content: z.string().trim().min(10).max(20000),
  status: publicPostStatusSchema.default("DRAFT"),
  visibility: z.nativeEnum(Visibility).default(Visibility.PRIVATE),
  coverImageUrl: z
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Cover image URL must use http or https")
    .optional(),
  journeyId: z.string().trim().min(1).optional(),
  stopId: z.string().trim().min(1).optional(),
});

export const publicPostCreateSchema = publicPostBaseSchema;
export const publicPostUpdateSchema = publicPostBaseSchema;

export const publicPostPublishSchema = z.object({
  postId: z.string().min(1),
});

export type PublicPostCreateInput = z.infer<typeof publicPostCreateSchema>;
export type PublicPostUpdateInput = z.infer<typeof publicPostUpdateSchema>;
