// notify-addendum — emails a client the sign link for a service-agreement
// addendum ("נספח"). Invoked from the admin UI via the admin-gated
// `admin_send_addendum` RPC (pg_net → here with the shared secret), so it is
// never callable by a client. Sends via the Gmail API, records in email_log.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Orion";
const FROM_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";

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

async function logEmail(client: any, row: { kind: string; to_email: string; subject: string; html: string; ok: boolean; error?: string; context?: Record<string, unknown> }) {
  try {
    await client.from("email_log").insert({
      kind: row.kind, to_email: row.to_email, subject: row.subject, html: row.html,
      ok: row.ok, error: row.error ?? null, context: row.context ?? {},
    });
  } catch (e) {
    console.error("email_log insert failed", String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const got = req.headers.get("x-webhook-secret") ?? "";
  const { data: secretRow } = await admin.from("webhook_secrets").select("value").eq("name", "lead_notify").maybeSingle();
  if (!secretRow?.value || secretRow.value !== got) return json({ ok: false, error: "forbidden" }, 403);

  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "bad request" }, 400);
  }

  const addendumId = String(b?.addendum_id ?? "").trim();
  if (!addendumId) return json({ ok: false, error: "missing addendum_id" }, 400);

  const { data: ad } = await admin
    .from("agreement_addenda")
    .select("id, title, sign_token, client_id, service_agreements(full_name, email, gender)")
    .eq("id", addendumId)
    .maybeSingle();
  if (!ad) return json({ ok: false, error: "addendum not found" }, 404);

  const parent = (ad as any).service_agreements ?? {};
  const to = String(parent.email ?? "").trim();
  if (!to) return json({ ok: true, skipped: "no client email on the agreement" });

  const female = parent.gender === "female";
  const name = String(parent.full_name ?? "").trim();
  const hello = name ? `היי ${name},` : "היי,";
  const g = (m: string, f: string) => (female ? f : m);

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return json({ ok: false, error: "Gmail credentials not configured" }, 503);

  const link = `${PORTAL}/addendum/${(ad as any).sign_token}`;
  const subject = "נספח להסכם, ממתין לחתימתך";
  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><style>html,body,div,p,span,a,td,th,table,tr,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,b,em,small,button{font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif !important;}</style></head><body style="margin:0;background:#0b0a10;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px">
    <div style="max-width:540px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:20px 26px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:20px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · נספח להסכם</span>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 14px">${escapeHtml(hello)}</p>
        <p style="margin:0 0 14px">${escapeHtml(
          g("הכנתי נספח קצר להסכם השירות שלנו, בנושא: ", "הכנתי נספח קצר להסכם השירות שלנו, בנושא: ")
        )}<strong style="color:#fff">${escapeHtml(String((ad as any).title ?? ""))}</strong>.</p>
        <p style="margin:0 0 18px;color:#cfcfd4">${escapeHtml(
          g("קרא אותו וחתום כאן בעמוד, ומשם אני ממשיך.", "קראי אותו וחתמי כאן בעמוד, ומשם אני ממשיך.")
        )}</p>
        <div style="text-align:center">
          <a href="${link}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px">קריאה וחתימה על הנספח</a>
        </div>
      </div>
    </div>
  </div></body></html>`;

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await sendGmail(accessToken, to, subject, html);
    const ok = res.ok;
    const detail = ok ? undefined : `gmail ${res.status}: ${await res.text()}`.slice(0, 500);
    await logEmail(admin, { kind: "notify-addendum", to_email: to, subject, html, ok, error: detail, context: { addendum_id: addendumId } });
    return ok ? json({ ok: true }) : json({ ok: false, error: `gmail ${res.status}` }, 502);
  } catch (e) {
    await logEmail(admin, { kind: "notify-addendum", to_email: to, subject, html, ok: false, error: String(e).slice(0, 500), context: { addendum_id: addendumId } });
    return json({ ok: false, error: String(e) }, 500);
  }
});
