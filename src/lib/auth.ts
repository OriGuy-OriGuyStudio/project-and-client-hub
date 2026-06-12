import { supabase } from "./supabase";

/** Studio admin email - mirrors the server-side whitelist row. Env-locked. */
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

/**
 * Start the Google OAuth flow. Google is the ONLY supported provider -
 * no magic links, no email/password.
 */
export async function signInWithGoogle() {
  // Arm the post-login number/bar loader so it plays once when we return
  // authenticated (consumed by PostLoginLoader). Cleared if login doesn't complete.
  sessionStorage.setItem("sog-postlogin", "1");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) {
    sessionStorage.removeItem("sog-postlogin");
    throw error;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
