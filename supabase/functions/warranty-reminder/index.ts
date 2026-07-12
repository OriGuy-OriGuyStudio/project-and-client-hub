// Warranty-expiry reminder — runs daily (via pg_cron + pg_net) and emails each
// client 7 days before their project's 30-day warranty ends, exactly once.
//
// Sends through the **Gmail API** as the studio's own Google account
// (origuy@origuystudio.com), so mail comes from the real address (great
// deliverability, no third-party, and every reminder lands in Gmail "Sent").
// A Bcc to the studio gives an inbox copy too.
//
// Auth: pg_cron sends `Authorization: Bearer <CRON_SECRET>` (verify_jwt off,
// since the caller is not a user). If the Gmail OAuth secrets aren't set yet the
// function no-ops gracefully. On a successful send it flips
// projects.warranty_email_sent = true and drops an in-app notification.

import { createClient } from "npm:@supabase/supabase-js@2";

const WINDOW_DAYS = 7;
const FROM_NAME = "Ori Guy Studio";
const FROM_EMAIL = "origuy@origuystudio.com";
const STUDIO_BCC = "origuy@origuystudio.com"; // inbox copy for Ori
const PORTAL_URL = "https://orion.origuystudio.com"; // "Orion" client portal

type Contact = {
  studioName: string;
  email: string;
  phoneText: string; // as displayed
  phoneTel: string; // +972…
  whatsapp: string; // https://wa.me/972…
};

type Candidate = {
  id: string;
  title: string;
  client_id: string;
  warranty_end_date: string;
  profiles: { email: string | null; full_name: string | null } | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
/** base64 of a UTF-8 string (for the Hebrew subject + HTML body). */
function b64utf8(s: string): string {
  return bytesToBase64(encoder.encode(s));
}
/** base64url of an all-ASCII string (the assembled MIME message). */
function b64urlAscii(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Branded RTL HTML email. Every text block carries inline `dir="rtl"` +
 * `text-align:right` because Gmail strips `dir` off <html>/<body>. Header is the
 * "Orion" wordmark (no image — email-safe), with a project/date card, a portal
 * CTA, and a contact footer.
 */
function buildHtml(
  bodyText: string,
  project: string,
  endHe: string,
  c: Contact
) {
  const paragraphs = escapeHtml(bodyText)
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 10px">${line}</p>` : "<br>"))
    .join("");
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10;font-family:Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">

      <div dir="rtl" style="padding:22px 28px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.5px">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ${escapeHtml(c.studioName)}</span>
      </div>

      <div dir="rtl" style="padding:28px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        ${paragraphs}

        <div dir="rtl" style="margin-top:20px;padding:14px 16px;background:rgba(180,214,112,.08);border:1px solid rgba(180,214,112,.2);border-radius:12px;text-align:right">
          <div style="font-size:12px;color:#a7a7ad">פרויקט</div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:8px">${escapeHtml(project)}</div>
          <div style="font-size:12px;color:#a7a7ad">תום האחריות</div>
          <div style="font-size:16px;font-weight:700;color:#B4D670">${escapeHtml(endHe)}</div>
        </div>

        <div style="text-align:center;margin:26px 0 6px">
          <a href="${PORTAL_URL}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:999px">כניסה לפורטל</a>
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

/**
 * Apply per-client tokens to the template:
 *  - `{שם}` / `{name}` → the client's first name (dropped if unknown).
 *  - `זכר|נקבה` (any `word|word`) → the gender-correct side: left = male/
 *    default, right = female. Picked from the gender on the client's CRM note.
 */
function personalize(
  body: string,
  firstName: string,
  gender: string | null
): string {
  const named = body.replace(/ ?\{(?:שם|name)\}/g, firstName ? ` ${firstName}` : "");
  return named.replace(/([^\s|]+)\|([^\s|]+)/g, (_m, male, female) =>
    gender === "female" ? female : male
  );
}

/** Exchange the long-lived refresh token for a short-lived access token. */
async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
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

/** Send one HTML email via the Gmail API as the authorized account. */
async function sendGmail(
  accessToken: string,
  to: string,
  subject: string,
  html: string
): Promise<Response> {
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

  return await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: b64urlAscii(mime) }),
    }
  );
}

Deno.serve(async (req) => {
  // --- Auth: shared secret from pg_cron --------------------------------------
  const cronSecret = Deno.env.get("CRON_SECRET");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!cronSecret || token !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

  // --- Graceful no-op until the Gmail OAuth secrets are wired up --------------
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ skipped: "no Gmail credentials", sent: 0 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Candidates: warranty ending within the window, not yet emailed, live project.
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() + WINDOW_DAYS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data: projects, error: qErr } = await supabase
    .from("projects")
    .select("id, title, client_id, warranty_end_date, profiles(email, full_name)")
    .eq("warranty_email_sent", false)
    .neq("status", "cancelled")
    .not("warranty_end_date", "is", null)
    .gte("warranty_end_date", iso(today))
    .lte("warranty_end_date", iso(until))
    .returns<Candidate[]>();

  if (qErr) return json({ error: qErr.message }, 500);
  if (!projects || projects.length === 0) return json({ processed: 0, sent: 0 });

  // Brand business names (no direct projects→client_brand FK, so fetch by client).
  const clientIds = [...new Set(projects.map((p) => p.client_id))];
  const { data: brands } = await supabase
    .from("client_brand")
    .select("client_id, business_name")
    .in("client_id", clientIds);
  const brandName = new Map(
    (brands ?? []).map((b) => [b.client_id, b.business_name as string | null])
  );

  // Per-client gender (from the admin CRM note) for gendered Hebrew phrasing.
  const { data: notes } = await supabase
    .from("admin_client_notes")
    .select("client_id, gender")
    .in("client_id", clientIds);
  const genderMap = new Map(
    (notes ?? []).map((n) => [n.client_id, n.gender as string | null])
  );

  const { data: settings } = await supabase
    .from("studio_settings")
    .select("studio_name, contact_email, contact_phone, warranty_email_subject, warranty_email_body")
    .maybeSingle();
  const subject =
    settings?.warranty_email_subject || "האחריות על האתר שלך מתקרבת לסיום";
  const bodyText =
    settings?.warranty_email_body || "תקופת האחריות על האתר שלך מתקרבת לסיום.";

  // Contact block for the footer (from Settings, with sensible fallbacks).
  const rawPhone = (settings?.contact_phone || "0547520899").replace(/\D/g, "");
  const intlPhone = rawPhone.replace(/^0/, "972");
  const contact: Contact = {
    studioName: settings?.studio_name || "Ori Guy Studio",
    email: settings?.contact_email || FROM_EMAIL,
    phoneText: settings?.contact_phone || "054-752-0899",
    phoneTel: "+" + intlPhone,
    whatsapp: "https://wa.me/" + intlPhone,
  };

  let accessToken: string;
  try {
    accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
  } catch (e) {
    console.error("token error", String(e));
    return json({ error: "gmail auth failed", detail: String(e) }, 500);
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const p of projects) {
    const to = p.profiles?.email;
    if (!to) {
      failed++;
      continue;
    }
    const endHe = new Date(p.warranty_end_date).toLocaleDateString("he-IL");
    const projectName = brandName.get(p.client_id) || p.title;
    const firstName = (p.profiles?.full_name || "").trim().split(/\s+/)[0] || "";
    const personalBody = personalize(bodyText, firstName, genderMap.get(p.client_id) ?? null);

    try {
      const res = await sendGmail(
        accessToken,
        to,
        subject,
        buildHtml(personalBody, projectName, endHe, contact)
      );
      if (!res.ok) {
        const t = await res.text();
        console.error("gmail send failed", p.id, res.status, t);
        errors.push(`${res.status}: ${t}`);
        failed++;
        continue;
      }

      // Mark sent + notify in-app. Keep going even if the notification insert
      // fails — the email already went out.
      await supabase
        .from("projects")
        .update({ warranty_email_sent: true })
        .eq("id", p.id);

      await supabase.from("notifications").insert({
        audience: "client",
        recipient_id: p.client_id,
        type: "warranty_reminder",
        title: "האחריות מתקרבת לסיום",
        body: `האחריות על "${projectName}" מסתיימת ב-${endHe}.`,
        link: `/projects/${p.id}`,
        project_id: p.id,
      });

      sent++;
    } catch (e) {
      console.error("send error", p.id, String(e));
      errors.push(String(e));
      failed++;
    }
  }

  return json({ processed: projects.length, sent, failed, errors });
});
