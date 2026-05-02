"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const supabaseEnv = getSupabasePublicEnv();

  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    throw new Error(
      "Supabase browser configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
}
