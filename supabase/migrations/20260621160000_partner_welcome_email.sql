-- ============================================================
-- 0061 — Separate "welcome" email template for partners
-- A whitelisted partner was getting the client welcome copy. Add a partner
-- subject/body on the singleton settings; send-invite picks it when role =
-- 'partner' (falling back to the client copy if left blank).
-- ============================================================

alter table public.studio_settings
  add column if not exists welcome_email_subject_partner text
    default 'ברוכים הבאים לתוכנית השותפים של Orion',
  add column if not exists welcome_email_body_partner text;

update public.studio_settings set
  welcome_email_subject_partner = coalesce(
    welcome_email_subject_partner, 'ברוכים הבאים לתוכנית השותפים של Orion'
  ),
  welcome_email_body_partner = coalesce(
    welcome_email_body_partner,
    E'היי{שם},\nשמח|שמחה לצרף אותך לתוכנית השותפים של הסטודיו ב-Orion.\nמכאן תוכל|תוכלי להפנות לקוחות, לעקוב אחרי כל הפניה, לצבור מטבעות ולממש אותם בחנות השותפים.\n\nכדי להיכנס, לחץ|לחצי על הכפתור למטה והתחבר|התחברי עם חשבון ה-Google שאיתו הוזמנת.\n\nנתראה בפנים,\nאורי'
  )
where id = true;
