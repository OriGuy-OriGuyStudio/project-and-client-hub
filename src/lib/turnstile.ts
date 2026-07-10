import { supabase } from "@/lib/supabase";

// Cloudflare Turnstile. The site key is public (safe in client code); the secret
// lives in webhook_secrets and is used only by the verify-turnstile edge fn.
export const TURNSTILE_SITE_KEY = "0x4AAAAAADzceG2a7keuH1oK";

/** Server-side verify of a Turnstile token. Returns true only if it passed. */
export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { data, error } = await supabase.functions.invoke("verify-turnstile", { body: { token } });
    if (error) return false;
    return (data as { success?: boolean })?.success === true;
  } catch {
    return false;
  }
}
