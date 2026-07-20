// notify-admin-task — emails the studio inbox that a new task is waiting for the
// admin (a store redemption or a client chat message). Fixed recipient (the
// studio), so any signed-in user may trigger it without leaking anything.
// verify_jwt stays ON. Sends via the Gmail API (shared OAuth secrets).

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Orion";
const FROM_EMAIL = "origuy@origuystudio.com";
const TO_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  // Any signed-in user may notify the studio (fixed recipient).
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: me } = await asUser.auth.getUser();
  if (!me?.user) return json({ error: "unauthorized" }, 401);

  let title = "", body = "";
  try {
    const b = await req.json();
    title = String(b?.title ?? "").trim().slice(0, 140);
    body = String(b?.body ?? "").trim().slice(0, 600);
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!title) return json({ error: "missing title" }, 400);

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const subject = `🔔 ${title}`;

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><style>html,body,div,p,span,a,td,th,table,tr,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,b,em,small,button{font-family:Arial,Helvetica,"Segoe UI","Helvetica Neue",sans-serif !important;}</style></head><body style="margin:0;background:#0b0a10;font-family:Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:540px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:20px 26px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:20px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ממתין לטיפול</span>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 10px;font-weight:800;color:#fff">${escapeHtml(title)}</p>
        <p style="margin:0 0 18px;color:#cfcfd4">${escapeHtml(body)}</p>
        <div style="text-align:center">
          <a href="${PORTAL}/admin" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px">פתיחת לוח הבקרה</a>
        </div>
      </div>
    </div>
  </div></body></html>`;

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      await logEmail(admin, {
        kind: "notify-admin-task",
        to_email: TO_EMAIL,
        subject,
        html,
        ok: false,
        error: `gmail ${res.status}: ${detail}`,
        context: { title, body },
      });
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    await logEmail(admin, {
      kind: "notify-admin-task",
      to_email: TO_EMAIL,
      subject,
      html,
      ok: true,
      context: { title, body },
    });
    return json({ ok: true });
  } catch (e) {
    console.error("notify-admin-task error", String(e));
    await logEmail(admin, {
      kind: "notify-admin-task",
      to_email: TO_EMAIL,
      subject,
      html,
      ok: false,
      error: String(e),
      context: { title, body },
    });
    return json({ ok: false, error: String(e) }, 500);
  }
});
