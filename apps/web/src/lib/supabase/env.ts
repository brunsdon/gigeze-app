import { getPublicEnv } from "@/lib/env";

export function getSupabasePublicEnv() {
  const publicEnv = getPublicEnv();

  return {
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
