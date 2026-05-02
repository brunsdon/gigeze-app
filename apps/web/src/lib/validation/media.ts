import { Visibility } from "@prisma/client";
import { z } from "zod";

export const mediaMetadataSchema = z.object({
  journeyId: z.string().optional(),
  stopId: z.string().optional(),
  filePath: z.string().min(1),
  publicUrl: z.url().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  caption: z.string().trim().max(1000).optional(),
  visibility: z.nativeEnum(Visibility).default(Visibility.PRIVATE),
});

export type MediaMetadataInput = z.infer<typeof mediaMetadataSchema>;
