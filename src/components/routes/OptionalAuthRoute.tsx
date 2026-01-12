import { ReactNode } from "react";

interface OptionalAuthRouteProps {
  children: ReactNode;
}

/**
 * OptionalAuthRoute - allows both anonymous and authenticated users
 * Unlike ProtectedRoute, this does NOT redirect to /auth
 * Child components should handle their own auth-aware UI (e.g., showing CTAs)
 */
export const OptionalAuthRoute = ({ children }: OptionalAuthRouteProps) => {
  // Simply render children - no auth check, no redirect
  // Components inside should use supabase.auth.getUser() to conditionally render
  return <>{children}</>;
};
