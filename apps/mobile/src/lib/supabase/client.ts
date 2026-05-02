import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { requireSupabaseConfig } from "../config";
import { mobileStorage } from "../storage/mobile-storage";

let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { supabaseUrl, supabaseAnonKey } = requireSupabaseConfig();

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: mobileStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}
