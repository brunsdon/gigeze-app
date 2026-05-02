import type { PropsWithChildren } from "react";
import { AuthProvider } from "../../features/auth/auth-context";
import { TripProvider } from "../../features/trips/trip-state";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <TripProvider>{children}</TripProvider>
    </AuthProvider>
  );
}
