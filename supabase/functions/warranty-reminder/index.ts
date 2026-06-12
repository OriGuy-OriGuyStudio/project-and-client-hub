// Warranty-expiry reminder — runs daily (via pg_cron + pg_net) and emails each
// client 7 days before their project's 30-day warranty ends, exactly once.
//
// Auth: pg_cron sends `Authorization: Bearer <CRON_SECRET>` (verify_jwt is off,
// since the caller is not a user). The function compares it to the CRON_SECRET
// env. If RESEND_API_KEY is missing it no-ops gracefully (so the schedule can
// run harmlessly before the key is wired up).
//
// On a successful send it flips projects.warranty_email_sent = true and drops an
// in-app notification for the client; failures leave the row unsent to retry.

import { createClient } from "npm:@supabase/supabase-js@2";

const WINDOW_DAYS = 7;
const FROM = "Studio Ori Guy <noreply@origuystudio.com>";
const FALLBACK_CC = "origuy@origuystudio.com";

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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

Deno.serve(async (req) => {
  // --- Auth: shared secret from pg_cron --------------------------------------
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!cronSecret || token !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");

  // --- Graceful no-op until the email provider is wired up -------------------
  if (!resendKey) {
    return json({ skipped: "no RESEND_API_KEY", sent: 0 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Candidates: warranty ending within the window, not yet emailed, live project.
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() + WINDOW_DAYS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data: projects, error: qErr } = await supabase
    .from("projects")
    .select(
      "id, title, client_id, warranty_end_date, profiles(email, full_name)"
    )
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
    .select("warranty_email_subject, warranty_email_body, contact_email")
    .maybeSingle();

  const subject =
    settings?.warranty_email_subject || "האחריות על האתר שלך מתקרבת לסיום";
  const bodyText = settings?.warranty_email_body || "תקופת האחריות על האתר שלך מתקרבת לסיום.";
  const cc = settings?.contact_email || FALLBACK_CC;

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
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          cc: cc ? [cc] : undefined,
          subject,
          html: buildHtml(bodyText, projectName, endHe),
        }),
      });

      if (!res.ok) {
        console.error("resend failed", p.id, res.status, await res.text());
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
