import { ExternalMediaEntityType } from "@prisma/client";
import { z } from "zod";

export const externalMediaLinkCreateSchema = z.object({
  entityType: z.nativeEnum(ExternalMediaEntityType),
  entityId: z.string().trim().min(1).max(191),
  url: z.string().trim().min(1).max(2_048),
  title: z.string().trim().max(160).optional(),
  caption: z.string().trim().max(2_000).optional(),
});

export const externalMediaLinkUpdateSchema = z.object({
  title: z.string().trim().max(160).optional(),
  caption: z.string().trim().max(2_000).optional(),
});

export type ExternalMediaLinkCreateInput = z.infer<typeof externalMediaLinkCreateSchema>;
export type ExternalMediaLinkUpdateInput = z.infer<typeof externalMediaLinkUpdateSchema>;
