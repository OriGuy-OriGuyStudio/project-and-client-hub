import { supabase } from "@/lib/supabase";

function deviceKind(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
}

/**
 * Fire-and-forget first-party usage event. The DB RPC (`log_usage_event`) drops
 * admin + anon activity, so Ori is never measured even if this is called for
 * him. Never throws — analytics must not be able to break the app.
 */
export function track(
  event: string,
  meta: Record<string, unknown> = {},
  path?: string
): void {
  try {
    void supabase.rpc("log_usage_event", {
      p_event: event,
      p_path: path ?? (typeof window !== "undefined" ? window.location.pathname : null),
      p_meta: { device: deviceKind(), ...meta },
    });
  } catch {
    /* swallow */
  }
}
