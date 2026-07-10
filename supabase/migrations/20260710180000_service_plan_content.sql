-- ============================================================
-- 0098 — editable package content (admin plans editor)
-- ============================================================
-- Moves the package definitions (name/label/tagline/price/response/hours + the
-- full feature lists per site type) out of code and into the DB so the admin can
-- add / change / remove what each plan includes, without touching code.
--
-- service-plans.ts stays as the seed + fallback. The landing and NEW agreements
-- read this live content; an already-signed agreement keeps its frozen snapshot,
-- and an existing client's dashboard reads that snapshot, so editing here does
-- not change what current clients already have.
--
-- Public read (the no-auth landing needs it); admin-only writes.
-- ============================================================

create table if not exists public.service_plan_content (
  tier            text primary key check (tier in ('core','pro','ultra')),
  sort            int  not null,
  name            text not null,
  label           text not null,
  tagline         text not null,
  price           numeric not null,
  response_hours  int  not null,
  hours           int  not null,
  features_wp     jsonb not null default '[]'::jsonb,
  features_custom jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.service_plan_content enable row level security;
-- Marketing content, safe to read publicly (the anon landing shows it anyway).
create policy spc_read  on public.service_plan_content for select to anon, authenticated using (true);
create policy spc_admin on public.service_plan_content for all    to authenticated using (is_admin()) with check (is_admin());

-- seed with the current values from service-plans.ts (full per-tier lists) -----
insert into public.service_plan_content (tier, sort, name, label, tagline, price, response_hours, hours, features_wp, features_custom) values
(
  'core', 1, 'Studio Core', 'שקט נפשי', 'שקט ואתר תקין ומאובטח', 450, 48, 0,
  $$[
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    "רישיונות עיצוב כלולים: Elementor Pro + Crocoblock (שווי מעל ₪1,172 בשנה)",
    "רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "דו״ח פעילות וביצועים חודשי"
  ]$$::jsonb,
  $$[
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    "SSL, גיבויי קוד ומסד נתונים, ו-CDN גלובלי מהיר",
    "רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "דו״ח פעילות וביצועים חודשי"
  ]$$::jsonb
),
(
  'pro', 2, 'Studio Pro', 'השותף הטכני שלך', 'השותף הטכני שלך', 800, 24, 3,
  $$[
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    "רישיונות עיצוב כלולים: Elementor Pro + Crocoblock (שווי מעל ₪1,172 בשנה)",
    "רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "דו״ח פעילות וביצועים חודשי",
    "מאיץ מהירות ו-CDN מתקדם",
    "הגנת נוזקות וסריקות בזמן אמת, כולל בדיקת שלמות קבצים",
    "הגנת ספאם על הטפסים, בלי תיבות אימות מעצבנות",
    "הגנה על עמוד ניהול האתר מפני ניסיונות פריצה",
    "תמונות מומרות ומואצות אוטומטית בהעלאה",
    "מעקב ביצועים ומהירות בזמן אמת"
  ]$$::jsonb,
  $$[
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    "SSL, גיבויי קוד ומסד נתונים, ו-CDN גלובלי מהיר",
    "רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "דו״ח פעילות וביצועים חודשי",
    "מאיץ מהירות ו-CDN מתקדם",
    "סריקת חולשות אבטחה בכל ה-dependencies",
    "הגנת ספאם על הטפסים, בלי תיבות אימות מעצבנות",
    "מעקב ביצועים ומהירות בזמן אמת"
  ]$$::jsonb
),
(
  'ultra', 3, 'Studio Ultra VIP', 'ה-CTO האישי שלך', 'ה-CTO האישי שלך', 1500, 4, 7,
  $$[
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    "רישיונות עיצוב כלולים: Elementor Pro + Crocoblock (שווי מעל ₪1,172 בשנה)",
    "רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "דו״ח פעילות וביצועים חודשי",
    "מאיץ מהירות ו-CDN מתקדם",
    "הגנת נוזקות וסריקות בזמן אמת, כולל בדיקת שלמות קבצים",
    "הגנת ספאם על הטפסים, בלי תיבות אימות מעצבנות",
    "הגנה על עמוד ניהול האתר מפני ניסיונות פריצה",
    "תמונות מומרות ומואצות אוטומטית בהעלאה",
    "מעקב ביצועים ומהירות בזמן אמת",
    "משאבי שרת ייעודיים, בלי לחלוק תשתית",
    "גיבוי כפול, במיקום נפרד לגמרי מהאחסון הראשי",
    "קדימות בתור על פני עבודות חדשות",
    "פגישת חשיבה אסטרטגית רבעונית"
  ]$$::jsonb,
  $$[
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    "SSL, גיבויי קוד ומסד נתונים, ו-CDN גלובלי מהיר",
    "רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "דו״ח פעילות וביצועים חודשי",
    "מאיץ מהירות ו-CDN מתקדם",
    "סריקת חולשות אבטחה בכל ה-dependencies",
    "הגנת ספאם על הטפסים, בלי תיבות אימות מעצבנות",
    "מעקב ביצועים ומהירות בזמן אמת",
    "משאבי שרת ייעודיים, בלי לחלוק תשתית",
    "גיבוי כפול, במיקום נפרד לגמרי מהאחסון הראשי",
    "קדימות בתור על פני עבודות חדשות",
    "פגישת חשיבה אסטרטגית רבעונית"
  ]$$::jsonb
)
on conflict (tier) do nothing;

notify pgrst, 'reload schema';
