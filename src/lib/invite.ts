import { supabase } from "@/lib/supabase";

export interface InviteResult {
  ok: boolean;
  error?: string;
}

/**
 * Trigger the branded "ברוכים הבאים ל-Orion" invitation email for a whitelisted
 * client/partner (the `send-invite` Edge Function sends it via Gmail and stamps
 * `allowed_emails.invite_sent_at`). The caller must be a signed-in admin — the
 * function re-checks the role. Never throws: returns `{ ok, error }` so callers
 * can toast either outcome without blocking the create flow.
 */
export async function sendInvite(email: string): Promise<InviteResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: { email },
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: data.error || "send failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Send a preview of an email template to the signed-in admin's own inbox, so they
 * can check how it looks. `to` (the admin's email) is returned on success.
 */
export async function sendTestEmail(
  template: "welcome" | "warranty"
): Promise<InviteResult & { to?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-test-email", {
      body: { template },
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: data.error || "send failed" };
    return { ok: true, to: data?.to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Notify a client/partner by email that the admin granted them gift /
 * compensation coins waiting in the portal (the `send-gift-notice` Edge Function
 * sends it via Gmail; admin-gated). Best-effort: returns `{ ok, error }`.
 */
export async function sendGiftNotice(
  userId: string,
  kind: "gift" | "compensation",
  amount: number,
  reason: string
): Promise<InviteResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-gift-notice", {
      body: { userId, kind, amount, reason },
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: data.error || "send failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Notify a client/partner by email that the store redemption they requested was
 * approved and handled (the `send-redemption-notice` Edge Function, admin-gated).
 * Best-effort: returns `{ ok, error }`.
 */
export async function sendRedemptionNotice(
  userId: string,
  rewardName: string
): Promise<InviteResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-redemption-notice", {
      body: { userId, rewardName },
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: data.error || "send failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Email the studio (fixed recipient) that a new task is awaiting the admin —
 * a store redemption or a client chat message. Any signed-in user may trigger
 * it (it only ever emails the studio, never arbitrary addresses). Best-effort.
 */
/** Tag emails that originate from a non-production environment so the admin
 *  can tell where they came from (prod URL contains the prod project ref). */
const ENV_TAG = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.includes(
  "tirasinbjsotcrqggipe"
)
  ? ""
  : "[STAGING] ";

export async function notifyAdminTask(title: string, body: string): Promise<InviteResult> {
  try {
    const { data, error } = await supabase.functions.invoke("notify-admin-task", {
      body: { title: ENV_TAG + title, body },
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: data.error || "send failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
