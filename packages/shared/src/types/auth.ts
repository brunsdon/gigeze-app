export type AuthProvider = "supabase";

export type AuthSessionUser = {
  id: string;
  email?: string;
  displayName?: string;
};

export type AuthSession = {
  user: AuthSessionUser;
  accessToken?: string;
  expiresAt?: string;
};
