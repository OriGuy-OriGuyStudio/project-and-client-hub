// send-invite — emails a branded "ברוכים הבאים ל-Orion" invitation to a freshly
// whitelisted client/partner, inviting them to sign in.
//
// Called from the admin app via supabase.functions.invoke('send-invite', { body:
// { email } }) with the admin's JWT. verify_jwt stays ON; inside we additionally
// confirm the caller's role is 'admin' (get_my_role RPC) before doing anything.
//
// Sends through the **Gmail API** as the studio account (origuy@origuystudio.com),
// same mechanism as warranty-reminder (shared Gmail OAuth secrets). On success it
// stamps allowed_emails.invite_sent_at / invite_send_count / invite_last_status so
// the admin UI can show a "נשלחה ✓" indicator and offer a resend.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Studio Ori Guy";
const FROM_EMAIL = "origuy@origuystudio.com";
const STUDIO_BCC = "origuy@origuystudio.com"; // inbox copy for Ori
const DEFAULT_PORTAL = "https://orion.origuystudio.com";

// Called from the browser (supabase.functions.invoke), so every response — and a
// preflight OPTIONS — must carry CORS headers.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Contact = {
  studioName: string;
  email: string;
  phoneText: string;
  phoneTel: string;
  whatsapp: string;
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
function b64utf8(s: string): string {
  return bytesToBase64(encoder.encode(s));
}
function b64urlAscii(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Per-recipient tokens, identical to warranty-reminder:
 *  - `{שם}` / `{name}` → first name (dropped if unknown).
 *  - `word|word` → gender-correct side (left=male/default, right=female).
 * Pending invitees have no CRM gender yet, so gender defaults to male/neutral.
 */
function personalize(body: string, firstName: string, gender: string | null): string {
  const named = body.replace(/ ?\{(?:שם|name)\}/g, firstName ? ` ${firstName}` : "");
  return named.replace(/([^\s|]+)\|([^\s|]+)/g, (_m, male, female) =>
    gender === "female" ? female : male
  );
}

/** Branded RTL welcome email (inline dir=rtl everywhere — Gmail strips dir off html/body). */
function buildHtml(bodyText: string, loginUrl: string, c: Contact) {
  const paragraphs = escapeHtml(bodyText)
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 10px">${line}</p>` : "<br>"))
    .join("");
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">

      <div dir="rtl" style="padding:22px 28px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.5px">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ${escapeHtml(c.studioName)}</span>
      </div>

      <div dir="rtl" style="padding:28px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        ${paragraphs}

        <div style="text-align:center;margin:26px 0 6px">
          <a href="${loginUrl}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:999px">כניסה ל-Orion</a>
        </div>
        <div dir="rtl" style="text-align:center;font-size:12px;color:#a7a7ad;margin-top:8px">
          התחברו עם חשבון ה-Google שאיתו הוזמנתם
        </div>
      </div>

      <div dir="rtl" style="padding:20px 28px;border-top:1px solid #2a2a33;text-align:right;color:#a7a7ad;font-size:13px;line-height:1.9">
        <div style="font-weight:700;color:#e8e8ea;margin-bottom:4px">${escapeHtml(c.studioName)}</div>
        <div>אימייל: <a href="mailto:${c.email}" style="color:#B4D670;text-decoration:none">${escapeHtml(c.email)}</a></div>
        <div>טלפון: <a href="tel:${c.phoneTel}" style="color:#B4D670;text-decoration:none">${escapeHtml(c.phoneText)}</a></div>
        <div>וואטסאפ: <a href="${c.whatsapp}" style="color:#B4D670;text-decoration:none">שליחת הודעה</a></div>
      </div>

    </div>
  </div>
  </body></html>`;
}

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
  const j = await res.json();
  return j.access_token as string;
}

async function sendGmail(accessToken: string, to: string, subject: string, html: string): Promise<Response> {
  const mime = [
    `From: ${FROM_NAME} <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Bcc: ${STUDIO_BCC}`,
    `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64utf8(html),
  ].join("\r\n");

  return await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: b64urlAscii(mime) }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // --- Auth: caller must be a signed-in admin --------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: role, error: roleErr } = await asUser.rpc("get_my_role");
  if (roleErr) return json({ error: "auth check failed", detail: roleErr.message }, 401);
  if (role !== "admin") return json({ error: "forbidden" }, 403);

  // --- Input -----------------------------------------------------------------
  let email = "";
  try {
    const b = await req.json();
    email = String(b?.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!email) return json({ error: "missing email" }, 400);

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Whitelist row → role + name for the invitee.
  const { data: row, error: rowErr } = await admin
    .from("allowed_emails")
    .select("email, role, full_name, invite_send_count")
    .ilike("email", email)
    .maybeSingle();
  if (rowErr) return json({ ok: false, error: rowErr.message }, 500);
  if (!row) return json({ ok: false, error: "email not whitelisted" }, 404);

  const { data: settings } = await admin
    .from("studio_settings")
    .select("studio_name, contact_email, contact_phone, welcome_email_subject, welcome_email_body, welcome_email_subject_partner, welcome_email_body_partner, portal_url")
    .maybeSingle();

  // Partners get their own welcome copy; fall back to the client copy if blank.
  const isPartner = row.role === "partner";
  const subject =
    (isPartner && settings?.welcome_email_subject_partner) ||
    settings?.welcome_email_subject ||
    (isPartner ? "ברוכים הבאים לתוכנית השותפים של Orion" : "ברוכים הבאים ל-Orion");
  const bodyText =
    (isPartner && settings?.welcome_email_body_partner) ||
    settings?.welcome_email_body ||
    "ברוכים הבאים ל-Orion — הפורטל האישי שלך מול הסטודיו.";
  const portal = (settings?.portal_url || DEFAULT_PORTAL).replace(/\/+$/, "");
  const loginUrl = isPartner ? `${portal}/partner-portal/login` : `${portal}/login`;

  const rawPhone = (settings?.contact_phone || "0547520899").replace(/\D/g, "");
  const intlPhone = rawPhone.replace(/^0/, "972");
  const contact: Contact = {
    studioName: settings?.studio_name || "סטודיו אורי גיא",
    email: settings?.contact_email || FROM_EMAIL,
    phoneText: settings?.contact_phone || "054-752-0899",
    phoneTel: "+" + intlPhone,
    whatsapp: "https://wa.me/" + intlPhone,
  };

  const firstName = (row.full_name || "").trim().split(/\s+/)[0] || "";
  const personalBody = personalize(bodyText, firstName, null);

  // --- Send ------------------------------------------------------------------
  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, row.email, subject, buildHtml(personalBody, loginUrl, contact));
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      await admin
        .from("allowed_emails")
        .update({ invite_last_status: "failed", invite_last_error: `${res.status}: ${detail}`.slice(0, 500) })
        .ilike("email", email);
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }

    const sent = await res.json().catch(() => ({}));
    await admin
      .from("allowed_emails")
      .update({
        invite_sent_at: new Date().toISOString(),
        invite_send_count: (row.invite_send_count ?? 0) + 1,
        invite_last_status: "sent",
        invite_last_error: null,
      })
      .ilike("email", email);

    return json({ ok: true, messageId: sent?.id ?? null });
  } catch (e) {
    console.error("send-invite error", String(e));
    await admin
      .from("allowed_emails")
      .update({ invite_last_status: "failed", invite_last_error: String(e).slice(0, 500) })
      .ilike("email", email);
    return json({ ok: false, error: String(e) }, 500);
  }
});
