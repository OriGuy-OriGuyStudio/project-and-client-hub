// notify-service-welcome — emails the CLIENT a warm, marketing welcome when Ori
// activates their maintenance package (project_service.activated_at set null->
// value). Called by a DB trigger via pg_net. verify_jwt is OFF; authenticated by
// a shared secret in webhook_secrets. Resolves the client's email + gender from
// the project owner. Sends via Gmail (same OAuth secrets as the other mailers).

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Ori Guy Studio";
const FROM_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";
const NL = String.fromCharCode(10);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const got = req.headers.get("x-webhook-secret") ?? "";
  const { data: secretRow } = await admin.from("webhook_secrets").select("value").eq("name", "service_welcome_notify").maybeSingle();
  if (!secretRow?.value || secretRow.value !== got) return json({ ok: false, error: "forbidden" }, 403);

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }
  const projectId = String(b?.project_id ?? "").trim();
  if (!projectId) return json({ ok: false, error: "missing project_id" }, 400);

  // Resolve the client (project owner) and their profile.
  const { data: proj } = await admin.from("projects").select("client_id, title").eq("id", projectId).maybeSingle();
  if (!proj?.client_id) return json({ ok: false, error: "no client for project" });
  const { data: prof } = await admin.from("profiles").select("email, full_name, gender").eq("id", proj.client_id).maybeSingle();
  // The package may have its own notification email (set on the landing form
  // / admin edit), which takes priority over the account owner's login email.
  const { data: ps } = await admin.from("project_service").select("notify_email").eq("project_id", projectId).maybeSingle();
  const to = String(ps?.notify_email || prof?.email || "").trim();
  if (!to) return json({ ok: false, error: "client has no email" });

  const female = prof?.gender === "female";
  const g = (m: string, f: string) => (female ? f : m);
  const firstName = String(prof?.full_name ?? "").trim().split(/\s+/)[0] || g("לקוח יקר", "לקוחה יקרה");

  const clientIdEnv = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientIdEnv || !clientSecret || !refreshToken) return json({ ok: false, error: "Gmail credentials not configured" }, 503);

  const benefits = [
    ["🛡️", "מאובטח בשכבות", "חומת אש וסינון תעבורה זדונית חוסמים תוקפים עוד לפני שהם מגיעים לאתר."],
    ["💾", "מגובה אוטומטית", `עותק מלא של האתר נשמר כל יום, כדי שתמיד אפשר לחזור אחורה בשניות.`],
    ["📈", "מנוטר 24/7", g("תדע על כל תקלה עוד לפני הלקוחות שלך.", "תדעי על כל תקלה עוד לפני הלקוחות שלך.")],
    ["⚡", "מהיר ומעודכן", "עדכונים שוטפים ותחזוקה שוטפת שומרים על האתר חד ובריא."],
  ];
  const benefitsHtml = benefits.map(([e, t, d]) =>
    `<tr><td style="padding:10px 0;vertical-align:top;width:34px;font-size:20px;font-family:Arial,Helvetica,sans-serif">${e}</td>
     <td style="padding:10px 0;text-align:right;font-family:Arial,Helvetica,sans-serif">
       <div style="font-weight:700;color:#fff;font-size:15px">${escapeHtml(t)}</div>
       <div style="color:#b9b9c2;font-size:13.5px;line-height:1.6">${escapeHtml(d)}</div>
     </td></tr>`).join("");

  const subject = g("ברוך הבא, החבילה שלך פעילה 🎉", "ברוכה הבאה, החבילה שלך פעילה 🎉");
  const html = `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10;font-family:Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:20px;overflow:hidden">
      <div dir="rtl" style="padding:26px;border-bottom:1px solid #2a2a33;text-align:center;background:linear-gradient(135deg,rgba(180,214,112,.14),rgba(34,211,238,.08))">
        <div style="font-size:34px;line-height:1">🎉</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-top:8px">${g("ברוך הבא", "ברוכה הבאה")}, ${escapeHtml(firstName)}</div>
        <div style="font-size:14px;color:#B4D670;margin-top:4px">החבילה שלך פעילה, האתר שלך בידיים טובות</div>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.75">
        <p style="margin:0 0 14px">היי ${escapeHtml(firstName)}, שמח שהצטרפת. מהיום אני דואג לאתר שלך מאחורי הקלעים, ${g("ואתה מתפנה", "ואת מתפנה")} להתעסק בעסק.</p>
        <p style="margin:0 0 6px;color:#9a9aa4;font-size:13px">מה ${g("קיבלת", "קיבלת")} מהרגע הזה:</p>
        <table role="presentation" style="width:100%;border-collapse:collapse">${benefitsHtml}</table>
        <div style="text-align:center;margin-top:22px">
          <a href="${PORTAL}/service" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:800;font-size:15px;padding:13px 30px;border-radius:999px">לדשבורד השירות שלך</a>
        </div>
        <p style="margin:18px 0 0;color:#9a9aa4;font-size:13px;text-align:center">יש שאלה? פשוט ${g("השב", "השיבי")} למייל הזה, אני כאן.</p>
      </div>
    </div>
    <div style="text-align:center;color:#6a6a72;font-size:12px;margin-top:14px">Orion · Ori Guy Studio</div>
  </div></body></html>`;

  try {
    const accessTok = await getAccessToken(clientIdEnv, clientSecret, refreshToken);
    const res = await sendGmail(accessTok, to, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("notify-service-welcome error", String(e), NL);
    return json({ ok: false, error: String(e) }, 500);
  }
});
