-- ============================================================
-- 0023 — Welcome / invite email for new clients & partners
-- ============================================================
-- When the admin whitelists a new client/partner we now send a branded
-- "ברוכים הבאים ל-Orion" email (via the send-invite Edge Function / Gmail API)
-- inviting them to log in. This adds the editable template + per-invitee
-- send-tracking so the admin sees a "נשלחה ✓" indicator and can resend.

-- ---- Welcome-email template + portal URL on the singleton settings ----------
alter table public.studio_settings
  add column if not exists welcome_email_subject text default 'ברוכים הבאים ל-Orion',
  add column if not exists welcome_email_body text,
  add column if not exists portal_url text default 'https://orion.origuystudio.com';

update public.studio_settings set
  welcome_email_subject = coalesce(welcome_email_subject, 'ברוכים הבאים ל-Orion'),
  portal_url = coalesce(portal_url, 'https://orion.origuystudio.com'),
  welcome_email_body = coalesce(
    welcome_email_body,
    E'היי{שם},\nאני שמח|שמחה לארח אותך ב-Orion, הפורטל האישי שלך מול הסטודיו.\nכאן תוכל|תוכלי לעקוב אחרי הפרויקט, לאשר שלבים, לראות קבצים ולהיות איתי בקשר ישיר.\n\nכדי להיכנס, לחץ|לחצי על הכפתור למטה והתחבר|התחברי עם חשבון ה-Google שאיתו הוזמנת.\n\nנתראה בפנים,\nאורי'
  )
where id = true;

-- ---- Per-invitee send tracking on the whitelist -----------------------------
alter table public.allowed_emails
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_send_count int not null default 0,
  add column if not exists invite_last_status text check (invite_last_status in ('sent','failed')),
  add column if not exists invite_last_error text;
