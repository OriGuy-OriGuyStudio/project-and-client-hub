// notify-referral-approved — tells a client that their referral program is
// open: what they get (5% of the deal, paid in cash, plus loyalty coins), how
// to refer, and a link straight to the program page. Fired by a DB trigger when a row lands in
// `partner_enrollments`, and also on demand from the admin UI via the
// `resend_referral_welcome` RPC (the "שלח שוב" button).
// verify_jwt is OFF; authenticated by the shared `lead_notify` secret in
// public.webhook_secrets, like the other DB-invoked mailers.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Orion";
const FROM_EMAIL = "origuy@origuystudio.com";
const PORTAL = "https://orion.origuystudio.com";
// The client's referral program lives at /partner ("תוכנית שותפים" in the
// client nav), not /referrals , that path is the admin rewards store.
const PROGRAM_PATH = "/partner";
// The commission is paid out in CASH (Bit or bank transfer), not as store
// credit. The coins are a separate, smaller loyalty layer on top, and the
// numbers below are the ones the DB actually grants: +1 on submission
// (grant_referral_credit) and +5 more when the deal closes (the admin close
// flow in Referrals.tsx). Keep them in sync if those change.
const COMMISSION_PCT = 5;
const COINS_ON_SUBMIT = 1;
const COINS_ON_CLOSE = 5;

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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

  const clientId = String(b?.client_id ?? "").trim();
  if (!clientId) return json({ ok: false, error: "missing client_id" }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, gender")
    .eq("id", clientId)
    .maybeSingle();
  const to = (profile?.email ?? "").trim();
  if (!to) return json({ ok: true, skipped: "client has no email" });

  const female = profile?.gender === "female";
  const name = (profile?.full_name ?? "").trim();
  const hello = name ? `היי ${name},` : "היי,";
  // Gendered second person: the whole mail speaks directly to the client.
  const g = (m: string, f: string) => (female ? f : m);

  const googleId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!googleId || !googleSecret || !refreshToken) {
    return json({ ok: false, error: "Gmail credentials not configured" }, 503);
  }

  const subject = "פתחתי לך את תוכנית ההפניות";
  const steps = [
    g("ממלא פרטים של מישהו שאתה חושב שיתאים לי", "ממלאת פרטים של מישהו שאת חושבת שיתאים לי"),
    "אני יוצר קשר, ומעדכן אותך בכל שלב במייל",
    g(`נסגרה עסקה? אתה מקבל ${COMMISSION_PCT}% ממנה, ונסכם איך נוח לך לקבל`,
      `נסגרה עסקה? את מקבלת ${COMMISSION_PCT}% ממנה, ונסכם איך נוח לך לקבל`),
  ];

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><style>html,body,div,p,span,a,td,th,table,tr,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,b,em,small,button{font-family:Arial,Helvetica,"Segoe UI","Helvetica Neue",sans-serif !important;}</style></head><body style="margin:0;background:#0b0a10;font-family:Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:540px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:20px 26px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:20px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · תוכנית ההפניות</span>
      </div>
      <div dir="rtl" style="padding:26px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 14px">${escapeHtml(hello)}</p>
        <p style="margin:0 0 14px">${escapeHtml(
          g("פתחתי לך את תוכנית ההפניות שלי בפורטל. אם אתה מכיר מישהו שצריך אתר, מערכת או אוטומציה, אתה יכול להפנות אותו אליי ישירות משם.",
            "פתחתי לך את תוכנית ההפניות שלי בפורטל. אם את מכירה מישהו שצריך אתר, מערכת או אוטומציה, את יכולה להפנות אותו אליי ישירות משם.")
        )}</p>
        <div style="background:#0f0e14;border:1px solid #2a2a33;border-radius:12px;padding:16px;margin:0 0 12px;text-align:center">
          <p style="margin:0;color:#B4D670;font-size:22px;font-weight:800">${COMMISSION_PCT}% מסך העסקה, במזומן</p>
          <p style="margin:6px 0 0;color:#cfcfd4;font-size:14px">${escapeHtml(
            "על כל הפניה שנסגרת. העברה בביט או העברה בנקאית, מה שנוח לך."
          )}</p>
        </div>
        <div style="background:#0f0e14;border:1px solid #2a2a33;border-radius:12px;padding:14px 16px;margin:0 0 16px">
          <p style="margin:0 0 6px;font-weight:700;color:#fff">ובנוסף, מטבעות לחנות הפרסים</p>
          <p style="margin:0;color:#cfcfd4;font-size:14px">${escapeHtml(
            g(`${COINS_ON_SUBMIT} מטבע על כל הפניה שאתה מגיש, ועוד ${COINS_ON_CLOSE} מטבעות כשהעסקה נסגרת.`,
              `${COINS_ON_SUBMIT} מטבע על כל הפניה שאת מגישה, ועוד ${COINS_ON_CLOSE} מטבעות כשהעסקה נסגרת.`)
          )}</p>
        </div>
        <p style="margin:0 0 8px;font-weight:700">איך זה עובד</p>
        <ol style="margin:0 0 18px;padding-inline-start:18px;color:#cfcfd4">
          ${steps.map((s) => `<li style="margin:0 0 5px">${escapeHtml(s)}</li>`).join("")}
        </ol>
        <div style="text-align:center">
          <a href="${PORTAL}${PROGRAM_PATH}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px">מעבר לתוכנית ההפניות</a>
        </div>
      </div>
    </div>
  </div></body></html>`;

  try {
    const accessToken = await getAccessToken(googleId, googleSecret, refreshToken);
    const res = await sendGmail(accessToken, to, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gmail send failed", res.status, detail);
      await logEmail(admin, {
        kind: "notify-referral-approved",
        to_email: to,
        subject,
        html,
        ok: false,
        error: `gmail ${res.status}: ${detail}`.slice(0, 500),
        context: { client_id: clientId, commission_pct: COMMISSION_PCT, coins_submit: COINS_ON_SUBMIT, coins_close: COINS_ON_CLOSE, resent: b?.resent === true },
      });
      return json({ ok: false, error: `gmail ${res.status}` }, 502);
    }
    await logEmail(admin, {
      kind: "notify-referral-approved",
      to_email: to,
      subject,
      html,
      ok: true,
      context: { client_id: clientId, commission_pct: COMMISSION_PCT, coins_submit: COINS_ON_SUBMIT, coins_close: COINS_ON_CLOSE, resent: b?.resent === true },
    });
    return json({ ok: true });
  } catch (e) {
    console.error("notify-referral-approved error", String(e));
    await logEmail(admin, {
      kind: "notify-referral-approved",
      to_email: to,
      subject,
      html,
      ok: false,
      error: String(e).slice(0, 500),
      context: { client_id: clientId, commission_pct: COMMISSION_PCT, coins_submit: COINS_ON_SUBMIT, coins_close: COINS_ON_CLOSE, resent: b?.resent === true },
    });
    return json({ ok: false, error: String(e) }, 500);
  }
});
