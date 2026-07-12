// notify-service-status — emails a client that their service call's status
// changed (in_progress / done).
//
// Called from the admin app: supabase.functions.invoke('notify-service-status',
// { body: { callId } }) with the admin's JWT. Admin-gated. Sends via the Gmail
// API (shared OAuth secrets). Best-effort: returns { ok, error }.

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

function buildHtml(opts: { heading: string; lines: string[]; loginUrl: string; studioName: string }) {
  const paragraphs = opts.lines
    .map((line) => (line.trim() ? `<p style="margin:0 0 10px">${escapeHtml(line)}</p>` : "<br>"))
    .join("");
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10;font-family:Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:22px 28px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.5px">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ${escapeHtml(opts.studioName)}</span>
      </div>
      <div dir="rtl" style="padding:28px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 14px;font-size:20px;font-weight:800;color:#ffffff">${escapeHtml(opts.heading)}</p>
        ${paragraphs}
        <div style="text-align:center;margin:26px 0 6px">
          <a href="${opts.loginUrl}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:999px">מעבר לממשק</a>
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

  let callId = "";
  try {
    const b = await req.json();
    callId = String(b?.callId ?? "").trim();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!callId) return json({ error: "missing callId" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: call, error: callErr } = await admin
    .from("service_calls")
    .select("title, status, client_id, project_id")
    .eq("id", callId)
    .maybeSingle();
  if (callErr) return json({ ok: false, error: callErr.message }, 500);
  if (!call?.client_id) return json({ ok: false, error: "call/client not found" }, 404);
  if (call.status !== "in_progress" && call.status !== "done") {
    return json({ ok: true, skipped: "status not notifiable" });
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const { data: prof, error: profErr } = await admin
    .from("profiles").select("email, full_name").eq("id", call.client_id).maybeSingle();
  if (profErr) return json({ ok: false, error: profErr.message }, 500);
  // The package may have its own notification email (set on the landing form
  // / admin edit), which takes priority over the account owner's login email.
  const { data: ps } = await admin
    .from("project_service").select("notify_email").eq("project_id", call.project_id).maybeSingle();
  const to = String(ps?.notify_email || prof?.email || "").trim();
  if (!to) return json({ ok: false, error: "recipient not found" }, 404);

  const { data: settings } = await admin
    .from("studio_settings").select("studio_name, portal_url").maybeSingle();
  const studioName = settings?.studio_name || "Ori Guy Studio";
  const portal = (settings?.portal_url || DEFAULT_PORTAL).replace(/\/+$/, "");
  const loginUrl = `${portal}/service`;

  const firstName = (prof?.full_name || "").trim().split(/\s+/)[0] || "";
  const hi = firstName ? `היי ${firstName},` : "היי,";
  const done = call.status === "done";
  const heading = done ? "✅ קריאת השירות שלך טופלה" : "🛠️ קריאת השירות שלך בטיפול";
  const subject = done ? `קריאת השירות "${call.title}" טופלה` : `קריאת השירות "${call.title}" בטיפול`;
  const lines = [
    hi,
    done
      ? `הקריאה "${call.title}" טופלה. אפשר להיכנס לממשק ולראות את הפרטים.`
      : `התחלנו לטפל בקריאה "${call.title}". נעדכן ברגע שהיא תיסגר.`,
    "תודה!",
  ];

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, to, subject, buildHtml({ heading, lines, loginUrl, studioName }));
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    const sent = await res.json().catch(() => ({}));
    return json({ ok: true, messageId: sent?.id ?? null });
  } catch (e) {
    console.error("notify-service-status error", String(e));
    return json({ ok: false, error: String(e) }, 500);
  }
});
