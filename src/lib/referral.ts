import { supabase } from "@/lib/supabase";

/** Where partner referral links live: `<REFERRAL_BASE><code>`. Single source of
 *  truth — update here when the public domain is finalized. */
export const REFERRAL_BASE = "studioriguy.com/ref/";

export interface ResolveResult {
  valid: boolean;
  partner_name?: string | null;
}

/** Validate a referral code and get the referring partner's first name (only). */
export async function resolveReferral(code: string): Promise<ResolveResult> {
  const { data, error } = await supabase.rpc("resolve_referral", { p_code: code });
  if (error || !data) return { valid: false };
  return data as ResolveResult;
}

/** Record a click; returns a tracking id used to link a later conversion. */
export async function trackReferralClick(code: string): Promise<string | null> {
  const { data } = await supabase.rpc("track_referral_click", {
    p_code: code,
    p_ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
  });
  return (data as string) ?? null;
}

export interface SubmitLeadInput {
  code: string;
  name: string;
  phone: string;
  email?: string;
  type?: string;
  message?: string;
  clickId?: string | null;
}

/** Submit a lead from the landing (attributed to the partner if the code is valid). */
export async function submitReferralLead(
  i: SubmitLeadInput
): Promise<{ ok: boolean; attributed?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("submit_referral_lead", {
    p_code: i.code,
    p_name: i.name,
    p_phone: i.phone,
    p_email: i.email ?? null,
    p_type: i.type ?? null,
    p_message: i.message ?? null,
    p_click_id: i.clickId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean; attributed?: boolean }) ?? { ok: false };
}
