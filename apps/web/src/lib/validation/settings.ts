import { Visibility } from "@prisma/client";
import { z } from "zod";

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
});

export const workspaceSettingsSchema = z.object({
  workspaceName: z.string().trim().min(2).max(120),
  workspaceDescription: z.string().trim().max(2000).optional(),
  defaultJourneyVisibility: z.nativeEnum(Visibility),
  defaultPostVisibility: z.nativeEnum(Visibility),
  defaultMediaVisibility: z.nativeEnum(Visibility),
  gpsSamplingIntervalSeconds: z.coerce.number().int().min(5).max(300),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;
