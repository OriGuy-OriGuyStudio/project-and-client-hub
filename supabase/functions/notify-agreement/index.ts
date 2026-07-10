// notify-agreement — emails the studio when a client approves a maintenance
// package (an insert on service_agreements). Called by a DB trigger via pg_net,
// so every approval notifies regardless of path or any client-side failure.
// verify_jwt is OFF; authenticated by a shared secret in public.webhook_secrets,
// read here with the service role. Sends via the Gmail API (same OAuth secrets
// as the other mailers, mirroring notify-lead).

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Orion";
const FROM_EMAIL = "origuy@origuystudio.com";
const TO_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";

const NL = String.fromCharCode(10);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const encoder = new TextEncoder();
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
const b64utf8 = (s: string) => bytesToBase64(encoder.encode(s));
const b64urlAscii = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`oauth token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token as string;
}

async function sendGmail(accessToken: string, subject: string, html: string): Promise<Response> {
  const mime = [
    `From: ${FROM_NAME} <${FROM_EMAIL}>`,
    `To: ${TO_EMAIL}`,
    `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64utf8(html),
  ].join("\r\n");
  return await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64urlAscii(mime) }),
  });
}

// deno-lint-ignore no-explicit-any
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Authenticate the trigger via the shared secret.
  const got = req.headers.get("x-webhook-secret") ?? "";
  const { data: secretRow } = await admin
    .from("webhook_secrets")
    .select("value")
    .eq("name", "agreement_notify")
    .maybeSingle();
  if (!secretRow?.value || secretRow.value !== got) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  // deno-lint-ignore no-explicit-any
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "bad request" }, 400);
  }

  const name = String(b?.full_name ?? "").trim() || "לקוח";
  const business = String(b?.business ?? "").trim();
  const email = String(b?.email ?? "").trim();
  const phone = String(b?.phone ?? "").trim();
  const tierName = String(b?.tier_name ?? "").trim() || "חבילה";
  const siteType = String(b?.site_type_label ?? "").trim();
  const price = Number(b?.monthly_price ?? 0);
  const annual = String(b?.billing_cycle ?? "") === "annual";
  const accessToken = String(b?.access_token ?? "").trim();
  const clientId = String(b?.client_id ?? "").trim();

  const priceStr = price ? `₪${price.toLocaleString("he-IL")} / חודש` : "";
  const lines = [
    `שם: ${name}`,
    business ? `עסק: ${business}` : null,
    `חבילה: ${tierName}${priceStr ? ` · ${priceStr}` : ""} · ${annual ? "חיוב שנתי" : "חיוב חודשי"}`,
    siteType ? `סוג אתר: ${siteType}` : null,
    email ? `מייל: ${email}` : null,
    phone ? `טלפון: ${phone}` : null,
  ].filter(Boolean) as string[];

  const clientIdEnv = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientIdEnv || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const rowsHtml = lines
    .map((l) => `<p style="margin:0 0 6px;color:#cfcfd4">${escapeHtml(l)}</p>`)
    .join("");
  const docBtn = accessToken
    ? `<a href="${PORTAL}/l/agreement/${accessToken}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px;margin:4px">צפייה במסמך</a>`
    : "";
  const cardBtn = clientId
    ? `<a href="${PORTAL}/admin/clients/${clientId}" style="display:inline-block;background:transparent;color:#e8e8ea;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border:1px solid #2a2a33;border-radius:999px;margin:4px">כרטיס הלקוח</a>`
    : "";

  const subject = "אישור חבילת שירות חדש";
  const html = `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:540px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:20px 26px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:20px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · אישור חבילת שירות חדש</span>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        ${rowsHtml}
        <div style="text-align:center;margin-top:18px">${docBtn}${cardBtn}</div>
      </div>
    </div>
  </div></body></html>`;

  try {
    const accessTok = await getAccessToken(clientIdEnv, clientSecret, refreshToken);
    const res = await sendGmail(accessTok, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("notify-agreement error", String(e), NL);
    return json({ ok: false, error: String(e) }, 500);
  }
});
