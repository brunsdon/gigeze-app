import type { AuthProvider, AuthSession } from "@gigeze/shared";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getMobileConfig, hasSupabaseConfig } from "../../lib/config";
import { getSupabaseClient } from "../../lib/supabase/client";

export type MobileAuthService = {
  provider: AuthProvider;
  isConfigured: () => boolean;
  getCurrentSession: () => Promise<MobileAuthState>;
  signInWithPassword: (credentials: SignInCredentials) => Promise<MobileAuthState>;
  signOut: () => Promise<void>;
  onAuthStateChange: (callback: AuthStateChangeCallback) => AuthSubscription;
};

export type SignInCredentials = {
  email: string;
  password: string;
};

export type MobileAuthState = {
  session: AuthSession | null;
  supabaseSession: Session | null;
};

export type AuthStateChangeCallback = (event: AuthChangeEvent, state: MobileAuthState) => void;

export type AuthSubscription = {
  unsubscribe: () => void;
};

function toSharedAuthSession(session: Session | null): AuthSession | null {
  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName:
        typeof session.user.user_metadata.name === "string"
          ? session.user.user_metadata.name
          : typeof session.user.user_metadata.full_name === "string"
            ? session.user.user_metadata.full_name
            : undefined,
    },
    accessToken: session.access_token,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined,
  };
}

function toMobileAuthState(supabaseSession: Session | null): MobileAuthState {
  return {
    session: toSharedAuthSession(supabaseSession),
    supabaseSession,
  };
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /invalid refresh token|refresh token not found/i.test(error.message);
}

export function getAuthService(): MobileAuthService {
  return {
    provider: "supabase",
    isConfigured() {
      return hasSupabaseConfig(getMobileConfig());
    },
    async getCurrentSession() {
      const { data, error } = await getSupabaseClient().auth.getSession();

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await getSupabaseClient().auth.signOut({ scope: "local" });
          return toMobileAuthState(null);
        }

        throw error;
      }

      return toMobileAuthState(data.session);
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return toMobileAuthState(data.session);
    },
    async signOut() {
      const { error } = await getSupabaseClient().auth.signOut();

      if (error) {
        throw error;
      }
    },
    onAuthStateChange(callback) {
      if (!this.isConfigured()) {
        return {
          unsubscribe() {
            return undefined;
          },
        };
      }

      const {
        data: { subscription },
      } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
        callback(event, toMobileAuthState(session));
      });

      return subscription;
    },
  };
}
