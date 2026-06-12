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
const FROM_NAME = "Studio Ori Guy";
const FROM_EMAIL = "origuy@origuystudio.com";
const STUDIO_BCC = "origuy@origuystudio.com"; // inbox copy for Ori

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

/** Wrap the admin's plain-text template in a minimal RTL HTML email. */
function buildHtml(bodyText: string, project: string, endHe: string) {
  const paragraphs = escapeHtml(bodyText)
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 8px">${line}</p>` : "<br>"))
    .join("");
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#0b0a10;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:16px;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#e8e8ea;line-height:1.6">
      <div style="font-size:15px">${paragraphs}</div>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #2a2a33;font-size:13px;color:#a7a7ad">
        פרויקט: <strong style="color:#e8e8ea">${escapeHtml(project)}</strong><br>
        תום האחריות: <strong style="color:#B4D670">${escapeHtml(endHe)}</strong>
      </div>
    </div>
  </body></html>`;
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

  const { data: settings } = await supabase
    .from("studio_settings")
    .select("warranty_email_subject, warranty_email_body")
    .maybeSingle();
  const subject =
    settings?.warranty_email_subject || "האחריות על האתר שלך מתקרבת לסיום";
  const bodyText =
    settings?.warranty_email_body || "תקופת האחריות על האתר שלך מתקרבת לסיום.";

  let accessToken: string;
  try {
    accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
  } catch (e) {
    console.error("token error", String(e));
    return json({ error: "gmail auth failed" }, 500);
  }

  let sent = 0;
  let failed = 0;

  for (const p of projects) {
    const to = p.profiles?.email;
    if (!to) {
      failed++;
      continue;
    }
    const endHe = new Date(p.warranty_end_date).toLocaleDateString("he-IL");
    const projectName = brandName.get(p.client_id) || p.title;

    try {
      const res = await sendGmail(
        accessToken,
        to,
        subject,
        buildHtml(bodyText, projectName, endHe)
      );
      if (!res.ok) {
        console.error("gmail send failed", p.id, res.status, await res.text());
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
      failed++;
    }
  }

  return json({ processed: projects.length, sent, failed });
});
