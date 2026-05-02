import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { hasPublicSupabaseEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabaseEnv = hasPublicSupabaseEnv() ? getSupabasePublicEnv() : null;

  if (!supabaseEnv || !supabaseEnv.url || !supabaseEnv.anonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
