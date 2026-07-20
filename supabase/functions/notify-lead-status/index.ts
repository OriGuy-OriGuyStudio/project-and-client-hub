// notify-lead-status — emails the person who REFERRED a lead (partner or
// client) whenever the studio moves that lead to a new stage. Called by DB
// triggers (after update of status on partner_leads / referrals) via pg_net,
// so it fires no matter where the change came from (admin leads page, partner
// detail, client detail) and a mail failure never blocks the update.
// verify_jwt is OFF; authenticated by the shared `lead_notify` secret in
// public.webhook_secrets, same as notify-lead. Sends via the Gmail API.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Orion";
const FROM_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";

// Client-facing wording per stage. Deliberately warm and non-technical: the
// referrer is a partner or a client, not an operator of the funnel.
const STATUS_HE: Record<string, { label: string; line: string }> = {
  submitted: { label: "התקבל", line: "הליד התקבל אצלי ואני מתחיל לטפל בו." },
  awaiting_intro: { label: "ממתין לשיחת היכרות", line: "יצרתי קשר ואני מתאם איתו שיחת היכרות." },
  intro_done: { label: "שיחת היכרות בוצעה", line: "שיחת ההיכרות בוצעה, ואני בונה עכשיו את ההצעה." },
  quote_sent: { label: "הצעת מחיר נשלחה", line: "שלחתי הצעת מחיר, ואני ממתין לתשובה." },
  client_approved: { label: "הלקוח אישר", line: "הלקוח אישר את ההצעה. מתקדמים." },
  closed: { label: "נסגר", line: "העסקה נסגרה בהצלחה. תודה על ההפניה." },
  not_relevant: { label: "לא רלוונטי", line: "הפעם זה לא התקדם, אבל ההפניה מוערכת מאוד. אשמח לבאה." },
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
const b64urlAscii = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

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

async function sendGmail(accessToken: string, to: string, subject: string, html: string): Promise<Response> {
  const mime = [
    `From: ${FROM_NAME} <${FROM_EMAIL}>`,
    `To: ${to}`,
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

  const referrerId = String(b?.referrer_id ?? "").trim();
  const status = String(b?.status ?? "").trim();
  const leadName = String(b?.lead_name ?? "").trim() || "הליד שהפנית";
  // "partner" → the partner portal's leads view, "client" → the client's
  // referral program page. Anything else falls back to the portal root.
  const audience = String(b?.audience ?? "").trim();
  const info = STATUS_HE[status];
  if (!referrerId || !info) return json({ ok: true, skipped: "unknown status or referrer" });

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, gender")
    .eq("id", referrerId)
    .maybeSingle();
  const to = (profile?.email ?? "").trim();
  if (!to) return json({ ok: true, skipped: "referrer has no email" });

  const female = profile?.gender === "female";
  const greetName = (profile?.full_name ?? "").trim();
  const hello = greetName ? `היי ${greetName},` : "היי,";
  const closing = female
    ? "תודה שאת מפנה אליי אנשים, זה שווה לי המון."
    : "תודה שאתה מפנה אליי אנשים, זה שווה לי המון.";

  // The client's referral program lives at /partner ("תוכנית שותפים" in the
  // client nav). /referrals is an ADMIN route, so sending a client there was a
  // dead link.
  const link = audience === "partner" ? `${PORTAL}/partner-portal/leads` : `${PORTAL}/partner`;
  const cta = audience === "partner" ? "מעבר ללידים שלך" : "מעבר לתוכנית ההפניות";

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  // Short subject, single RFC2047 encoded-word (same as the other mailers) so
  // Hebrew never renders as "???". Details live in the body.
  const subject = "עדכון על ליד שהפנית";
  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><style>html,body,div,p,span,a,td,th,table,tr,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,b,em,small,button{font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif !important;}</style></head><body style="margin:0;background:#0b0a10;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
    <div style="max-width:540px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:20px 26px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:20px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · עדכון סטטוס ליד</span>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 14px">${escapeHtml(hello)}</p>
        <p style="margin:0 0 14px">יש עדכון על <strong style="color:#fff">${escapeHtml(leadName)}</strong>:</p>
        <div style="background:#0f0e14;border:1px solid #2a2a33;border-radius:12px;padding:14px 16px;margin:0 0 14px">
          <p style="margin:0 0 6px;color:#B4D670;font-weight:700">${escapeHtml(info.label)}</p>
          <p style="margin:0;color:#cfcfd4">${escapeHtml(info.line)}</p>
        </div>
        <p style="margin:0 0 18px;color:#cfcfd4">${escapeHtml(closing)}</p>
        <div style="text-align:center">
          <a href="${link}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px">${escapeHtml(cta)}</a>
        </div>
      </div>
    </div>
  </div></body></html>`;

  const logContext = { referrer_id: referrerId, status, lead_name: leadName, audience };

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, to, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      await logEmail(admin, {
        kind: "notify-lead-status",
        to_email: to,
        subject,
        html,
        ok: false,
        error: `gmail ${res.status}: ${detail}`,
        context: logContext,
      });
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    await logEmail(admin, {
      kind: "notify-lead-status",
      to_email: to,
      subject,
      html,
      ok: true,
      context: logContext,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("notify-lead-status error", String(e));
    await logEmail(admin, {
      kind: "notify-lead-status",
      to_email: to,
      subject,
      html,
      ok: false,
      error: String(e),
      context: logContext,
    });
    return json({ ok: false, error: String(e) }, 500);
  }
});
