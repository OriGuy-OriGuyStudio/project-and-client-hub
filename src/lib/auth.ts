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

/**
 * Send a passwordless magic-link, but only to a whitelisted email. First asks the
 * server whether the address is authorized (allowed_emails); if not, no link is
 * sent and the admin is notified of the attempt. Returns the outcome so the UI
 * can message accordingly. A real send error (e.g. rate limit) is thrown.
 */
export async function signInWithEmail(
  email: string
): Promise<{ ok: boolean; reason?: "unauthorized" | "invalid" | "error" }> {
  const { data, error } = await supabase.rpc("request_email_login", { p_email: email });
  if (error) return { ok: false, reason: "error" };
  const res = data as { authorized: boolean; error?: string } | null;
  if (!res?.authorized) {
    return { ok: false, reason: res?.error === "invalid" ? "invalid" : "unauthorized" };
  }
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (otpError) throw otpError;
  return { ok: true };
}

export async function signOut() {
  await supabase.auth.signOut();
}
