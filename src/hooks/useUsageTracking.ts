import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";

/** Collapse dynamic ids so pages group together in the analytics. */
function normalize(path: string): string {
  return path
    .replace(/\/projects\/[0-9a-f-]{36}/i, "/projects/:id")
    .replace(/\/admin\/clients\/[0-9a-f-]{36}/i, "/admin/clients/:id")
    .replace(/\/admin\/partners\/[0-9a-f-]{36}/i, "/admin/partners/:id");
}

/**
 * Records one `session` per app load plus a `page_view` per route, for
 * clients & partners only. The admin is filtered out server-side too, so this
 * is belt-and-suspenders: we also skip the network call entirely for Ori.
 */
export function useUsageTracking(): void {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const sessionLogged = useRef(false);
  const measurable = !!profile && profile.role !== "admin";

  useEffect(() => {
    if (measurable && !sessionLogged.current) {
      sessionLogged.current = true;
      track("session", { role: profile?.role });
    }
  }, [measurable, profile?.role]);

  useEffect(() => {
    if (measurable) track("page_view", {}, normalize(pathname));
  }, [measurable, pathname]);
}
