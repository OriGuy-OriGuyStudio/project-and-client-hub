import { supabase } from "./supabase";

// Ori's own test accounts. They're real whitelisted users (so he can log in and
// click around), but the admin UI groups them into a separate "טסטים (דמה)"
// section so they never mix with real clients/partners.
// ⚠️ Keep in sync with the SQL whitelist in is_demo_account() (migration 0076).
export const DEMO_EMAILS = new Set<string>([
  "origuydev@gmail.com",
  "origuy2018@gmail.com",
]);

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Load a real user's data INTO a demo account (server-side deep copy, admin-only).
 * The demo's login/email is untouched; the source user is never modified.
 */
export async function cloneIntoDemo(demoId: string, sourceId: string): Promise<void> {
  const { error } = await supabase.rpc("clone_into_demo", {
    p_demo: demoId,
    p_source: sourceId,
  });
  if (error) throw error;
}

/** Wipe a demo account back to an empty state. */
export async function resetDemo(demoId: string): Promise<void> {
  const { error } = await supabase.rpc("reset_demo_account", { p_demo: demoId });
  if (error) throw error;
}
