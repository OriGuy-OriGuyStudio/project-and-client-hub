// send-redemption-notice — emails a client/partner that the redemption they
// requested in the store was approved and handled by the studio.
//
// Called from the admin app: supabase.functions.invoke('send-redemption-notice',
// { body: { userId, rewardName } }) with the admin's JWT. Admin-gated. Sends via
// the Gmail API (shared OAuth secrets). Best-effort: returns { ok, error }.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Ori Guy Studio";
const FROM_EMAIL = "origuy@origuystudio.com";
const STUDIO_BCC = "origuy@origuystudio.com";
const DEFAULT_PORTAL = "https://orion.origuystudio.com";

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

function buildHtml(opts: { lines: string[]; loginUrl: string; studioName: string }) {
  const paragraphs = opts.lines
    .map((line) => (line.trim() ? `<p style="margin:0 0 10px">${escapeHtml(line)}</p>` : "<br>"))
    .join("");
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><style>html,body,div,p,span,a,td,th,table,tr,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,b,em,small,button{font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif !important;}</style></head><body style="margin:0;background:#0b0a10;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:22px 28px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.5px">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ${escapeHtml(opts.studioName)}</span>
      </div>
      <div dir="rtl" style="padding:28px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 14px;font-size:20px;font-weight:800;color:#ffffff">🎉 המימוש שלך אושר!</p>
        ${paragraphs}
        <div style="text-align:center;margin:26px 0 6px">
          <a href="${opts.loginUrl}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:999px">כניסה ל-Orion</a>
        </div>
      </div>
      <div dir="rtl" style="padding:18px 28px;border-top:1px solid #2a2a33;text-align:right;color:#a7a7ad;font-size:13px">
        ${escapeHtml(opts.studioName)}
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
  return (await res.json()).access_token as string;
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: role, error: roleErr } = await asUser.rpc("get_my_role");
  if (roleErr) return json({ error: "auth check failed", detail: roleErr.message }, 401);
  if (role !== "admin") return json({ error: "forbidden" }, 403);

  let userId = "", rewardName = "";
  try {
    const b = await req.json();
    userId = String(b?.userId ?? "").trim();
    rewardName = String(b?.rewardName ?? "").trim();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!userId) return json({ error: "missing userId" }, 400);

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: prof, error: profErr } = await admin
    .from("profiles").select("email, full_name, role").eq("id", userId).maybeSingle();
  if (profErr) return json({ ok: false, error: profErr.message }, 500);
  if (!prof?.email) return json({ ok: false, error: "recipient not found" }, 404);

  const { data: settings } = await admin
    .from("studio_settings").select("studio_name, portal_url").maybeSingle();
  const studioName = settings?.studio_name || "Ori Guy Studio";
  const portal = (settings?.portal_url || DEFAULT_PORTAL).replace(/\/+$/, "");
  const loginUrl = prof.role === "partner" ? `${portal}/partner-portal/login` : `${portal}/login`;

  const firstName = (prof.full_name || "").trim().split(/\s+/)[0] || "";
  const hi = firstName ? `היי ${firstName},` : "היי,";
  const subject = "🎉 המימוש שלך אושר ב-Orion";
  const lines = [
    hi,
    rewardName ? `המימוש שלך — ${rewardName} — אושר וטופל על ידי הסטודיו.` : "המימוש שלך אושר וטופל על ידי הסטודיו.",
    "מוזמן/ת להיכנס לממשק לפרטים. תודה!",
  ];

  const html = buildHtml({ lines, loginUrl, studioName });
  const logContext = { user_id: userId, reward_name: rewardName };

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, prof.email, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      await logEmail(admin, {
        kind: "send-redemption-notice",
        to_email: prof.email,
        subject,
        html,
        ok: false,
        error: `gmail ${res.status}: ${detail}`,
        context: logContext,
      });
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    const sent = await res.json().catch(() => ({}));
    await logEmail(admin, {
      kind: "send-redemption-notice",
      to_email: prof.email,
      subject,
      html,
      ok: true,
      context: logContext,
    });
    return json({ ok: true, messageId: sent?.id ?? null });
  } catch (e) {
    console.error("send-redemption-notice error", String(e));
    await logEmail(admin, {
      kind: "send-redemption-notice",
      to_email: prof.email,
      subject,
      html,
      ok: false,
      error: String(e),
      context: logContext,
    });
    return json({ ok: false, error: String(e) }, 500);
  }
});
