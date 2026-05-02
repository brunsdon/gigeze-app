import type { AuthSession } from "@gigeze/shared";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { getAuthService, type SignInCredentials } from "./auth-service";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  supabaseSession: Session | null;
  provider: ReturnType<typeof getAuthService>["provider"];
  isConfigured: boolean;
  error: string | null;
  sessionWasRestored: boolean;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const authService = getAuthService();

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [sessionWasRestored, setSessionWasRestored] = useState(false);
  const isConfigured = authService.isConfigured();

  useEffect(() => {
    let isMounted = true;
    const subscription = authService.onAuthStateChange((_event, nextState) => {
      if (!isMounted) {
        return;
      }

      setSession(nextState.session);
      setSupabaseSession(nextState.supabaseSession);
      setStatus(nextState.session ? "signedIn" : "signedOut");
      setError(null);
    });

    authService
      .getCurrentSession()
      .then((currentState) => {
        if (!isMounted) {
          return;
        }

        setSession(currentState.session);
        setSupabaseSession(currentState.supabaseSession);
        setSessionWasRestored(Boolean(currentState.session));
        setStatus(currentState.session ? "signedIn" : "signedOut");
        setError(null);
      })
      .catch((unknownError: unknown) => {
        if (!isMounted) {
          return;
        }

        setError(unknownError instanceof Error ? unknownError.message : "Unable to initialize auth.");
        setSession(null);
        setSupabaseSession(null);
        setStatus("signedOut");
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (credentials: SignInCredentials) => {
    setError(null);

    try {
      const nextState = await authService.signInWithPassword(credentials);
      setSession(nextState.session);
      setSupabaseSession(nextState.supabaseSession);
      setSessionWasRestored(false);
      setStatus(nextState.session ? "signedIn" : "signedOut");
    } catch (unknownError) {
      setSession(null);
      setSupabaseSession(null);
      setStatus("signedOut");
      setError(unknownError instanceof Error ? unknownError.message : "Unable to sign in.");
      throw unknownError;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);

    try {
      await authService.signOut();
      setSession(null);
      setSupabaseSession(null);
      setSessionWasRestored(false);
      setStatus("signedOut");
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Unable to sign out.");
      throw unknownError;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      supabaseSession,
      provider: authService.provider,
      isConfigured,
      error,
      sessionWasRestored,
      signIn,
      signOut,
    }),
    [error, isConfigured, session, sessionWasRestored, signIn, signOut, status, supabaseSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
