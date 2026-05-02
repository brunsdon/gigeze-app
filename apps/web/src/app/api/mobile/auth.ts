import { createClient } from "@supabase/supabase-js";
import { getOrCreateCurrentUserFromSessionUser, getWorkspaceOwnerForUser } from "@/lib/auth/workspace";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function getMobileBearerAuthContext(request: Request) {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return null;
  }

  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(bearerToken);

  if (error || !data.user) {
    return null;
  }

  const user = await getOrCreateCurrentUserFromSessionUser({
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  });

  if (!user) {
    return null;
  }

  const workspace = await getWorkspaceOwnerForUser(user.id);
  if (!workspace) {
    return null;
  }

  return { user, workspace };
}
