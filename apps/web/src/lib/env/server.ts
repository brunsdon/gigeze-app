import { z } from "zod";
import { EnvConfigError, formatEnvIssues } from "@/lib/env/shared";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("media"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new EnvConfigError(formatEnvIssues(parsed.error, "server"));
  }

  cachedServerEnv = parsed.data;

  return cachedServerEnv;
}
