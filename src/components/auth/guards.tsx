import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { LoginIntro } from "@/components/layout/WelcomingWords";
import type { UserRole } from "@/types/database";

/** The home route for each role. */
function homeFor(role: UserRole | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "partner") return "/partner-portal";
  return "/";
}

/**
 * Gate for any authenticated area. Resolves the four auth states:
 *   loading -> branded loader
 *   unauthenticated -> /login
 *   denied (not whitelisted) -> /access-denied
 *   authenticated -> render children
 */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "denied") return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}

/** Admin-only routes. Other roles go to their own home. */
export function RequireAdmin() {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "denied") return <Navigate to="/access-denied" replace />;
  if (profile?.role !== "admin") return <Navigate to={homeFor(profile?.role)} replace />;
  return <Outlet />;
}

/** Client-only routes. Other roles go to their own home. */
export function RequireClient() {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "denied") return <Navigate to="/access-denied" replace />;
  if (profile?.role !== "client") return <Navigate to={homeFor(profile?.role)} replace />;
  return <Outlet />;
}

/** Partner-only routes. Other roles go to their own home. */
export function RequirePartner() {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "denied") return <Navigate to="/access-denied" replace />;
  if (profile?.role !== "partner") return <Navigate to={homeFor(profile?.role)} replace />;
  return <Outlet />;
}

/** For login screens: send signed-in users to their home. */
export function RedirectIfAuthed() {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "authenticated") return <Navigate to={homeFor(profile?.role)} replace />;
  if (status === "denied") return <Navigate to="/access-denied" replace />;
  return (
    <>
      {/* Greeting words play once over the login screen, then reveal it. */}
      <LoginIntro />
      <Outlet />
    </>
  );
}

/** /access-denied is only meaningful for the denied (whitelist-miss) state. */
export function RequireDenied() {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "authenticated") return <Navigate to={homeFor(profile?.role)} replace />;
  return <Outlet />;
}
