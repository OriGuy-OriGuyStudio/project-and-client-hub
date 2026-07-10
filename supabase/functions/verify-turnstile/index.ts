// verify-turnstile — server-side verification of a Cloudflare Turnstile token.
// Public forms (landing sign, referral landing) render the widget, then POST the
// token here BEFORE submitting, so bots that never solve the challenge are
// blocked. The secret is read from webhook_secrets['turnstile_secret'] with the
// service role. verify_jwt is OFF (called from anonymous public pages).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method not allowed" }, 405);

  let token = "";
  try {
    const b = await req.json();
    token = String(b?.token ?? "").trim();
  } catch { /* no body */ }
  if (!token) return json({ success: false, error: "missing token" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secretRow } = await admin
    .from("webhook_secrets").select("value").eq("name", "turnstile_secret").maybeSingle();
  const secret = secretRow?.value;
  if (!secret) return json({ success: false, error: "not configured" }, 503);

  const ip = req.headers.get("CF-Connecting-IP") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);

  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const d = await r.json();
    return json({ success: d.success === true, errors: d["error-codes"] ?? [] });
  } catch (e) {
    console.error("verify-turnstile error", String(e));
    return json({ success: false, error: String(e) }, 500);
  }
});
