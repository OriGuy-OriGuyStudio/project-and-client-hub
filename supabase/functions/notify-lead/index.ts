// notify-lead — emails the studio when a new partner lead is inserted. Called by
// a DB trigger (after insert on partner_leads) via pg_net, so EVERY lead notifies
// regardless of path or any client-side failure. verify_jwt is OFF; the request
// is authenticated by a shared secret in the public.webhook_secrets table, read
// here with the service role. Sends via the Gmail API (same OAuth secrets as the
// other mailers).

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Orion";
const FROM_EMAIL = "origuy@origuystudio.com";
const TO_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";

const NL = String.fromCharCode(10);

const PROJECT_TYPE_HE: Record<string, string> = {
  business_site: "אתר תדמית",
  ecommerce: "חנות",
  system: "מערכת / אפליקציה",
  other: "אחר",
};

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

/** Records the send attempt in email_log. Never throws: logging must not
 *  break or fail an email that was actually delivered. */
async function logEmail(
  client: any,
  row: { kind: string; to_email: string; subject: string; html: string; ok: boolean; error?: string; context?: Record<string, unknown> },
) {
  try {
    await client.from("email_log").insert({
      kind: row.kind,
      to_email: row.to_email,
      subject: row.subject,
      html: row.html,
      ok: row.ok,
      error: row.error ?? null,
      context: row.context ?? {},
    });
  } catch (e) {
    console.error("email_log insert failed", String(e));
  }
}

Deno.serve(async (req) => {
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
    .eq("name", "lead_notify")
    .maybeSingle();
  if (!secretRow?.value || secretRow.value !== got) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "bad request" }, 400);
  }

  const leadName = String(b?.lead_name ?? "").trim() || "ללא שם";
  const phone = String(b?.lead_phone ?? "").trim();
  const email = String(b?.lead_email ?? "").trim();
  const typeHe = PROJECT_TYPE_HE[String(b?.project_type ?? "")] ?? "אחר";
  const notes = String(b?.notes ?? "").trim();
  const quote = b?.quote_requested === true;

  let partnerName = "שותף";
  if (b?.partner_id) {
    const { data: p } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", b.partner_id)
      .maybeSingle();
    partnerName = p?.full_name || p?.email || "שותף";
  }

  const lines = [
    `שם: ${leadName}`,
    phone ? `טלפון: ${phone}` : null,
    email ? `מייל: ${email}` : null,
    `סוג פרויקט: ${typeHe}`,
    quote ? "ביקש הצעת מחיר" : null,
    notes ? `הערה: ${notes}` : null,
    `הופנה על ידי: ${partnerName}`,
  ].filter(Boolean) as string[];

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const rowsHtml = lines
    .map(
      (l) =>
        `<p style="margin:0 0 6px;color:#cfcfd4">${escapeHtml(l)}</p>`,
    )
    .join("");
  // Keep the subject short (one RFC2047 encoded-word, like send-invite) so Hebrew
  // never renders as "???". The lead's name is in the body.
  const subject = "ליד חדש משותף";
  const html = `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10;font-family:Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:540px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:20px 26px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:20px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ליד חדש משותף</span>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        ${rowsHtml}
        <div style="text-align:center;margin-top:18px">
          <a href="${PORTAL}/admin/partners" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px">פתיחת הלידים</a>
        </div>
      </div>
    </div>
  </div></body></html>`;

  const logContext = { partner_id: b?.partner_id ?? null, lead_name: leadName };

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      await logEmail(admin, {
        kind: "notify-lead",
        to_email: TO_EMAIL,
        subject,
        html,
        ok: false,
        error: `gmail ${res.status}: ${detail}`,
        context: logContext,
      });
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    await logEmail(admin, {
      kind: "notify-lead",
      to_email: TO_EMAIL,
      subject,
      html,
      ok: true,
      context: logContext,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("notify-lead error", String(e), NL);
    await logEmail(admin, {
      kind: "notify-lead",
      to_email: TO_EMAIL,
      subject,
      html,
      ok: false,
      error: String(e),
      context: logContext,
    });
    return json({ ok: false, error: String(e) }, 500);
  }
});
