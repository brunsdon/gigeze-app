import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireAuth() {
  return requireAuthenticatedUser();
}

export async function requireAdmin() {
  await requireWorkspaceOwner();
}
