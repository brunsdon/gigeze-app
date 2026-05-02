import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { EnvConfigError } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseEnv = getSupabasePublicEnv();

  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    throw new EnvConfigError(
      "Supabase client configuration is missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // In Server Components, Next.js exposes a read-only cookie store.
          // Supabase can still read existing auth cookies there; writes are handled
          // in middleware, route handlers, or server actions.
        }
      },
    },
  });
}
