import { supabase } from "./supabase";

/** Studio admin email - mirrors the server-side whitelist row. Env-locked. */
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

/**
 * Start the Google OAuth flow. Google is the ONLY supported provider -
 * no magic links, no email/password.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
