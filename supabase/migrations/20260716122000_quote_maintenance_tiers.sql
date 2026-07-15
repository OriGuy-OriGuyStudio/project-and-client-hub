-- ============================================================
-- Quote v2.1-B , per-product maintenance tiers (admin-curated).
-- Maintenance must adapt to the product: a website retainer, an automation
-- management retainer and a system SLA retainer are different products with
-- different prices and deliverables. Admin curates; the quote snapshots the
-- chosen tiers into its content. See spec 2026-07-16 §5.
-- Applied to the branch DB (dbchappsqcsixxecxzqv) only.
-- ============================================================

create table if not exists public.quote_maintenance_tiers (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('website','system','automation')),
  key text not null,
  name text not null,
  price numeric not null default 0,
  description text,
  recommended boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quote_maintenance_tiers enable row level security;

drop policy if exists quote_maintenance_tiers_admin on public.quote_maintenance_tiers;
create policy quote_maintenance_tiers_admin on public.quote_maintenance_tiers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.quote_maintenance_tiers (type, key, name, price, description, recommended, sort) values
  ('website',    'core',  'Core',      350,  'אירוח, גיבוי, אבטחה, עדכונים, תיקונים קטנים.', false, 10),
  ('website',    'pro',   'Pro',       850,  'כל Core + עריכות תוכן, אופטימיזציית ביצועים, פיצ׳רים קטנים, עדיפות.', true, 20),
  ('website',    'ultra', 'Ultra VIP', 1800, 'כל Pro + שעות חודשיות, SEO, אנליטיקס, SLA מהיר.', false, 30),
  ('automation', 'care',    'Care',    500,  'ניטור שהאוטומציות רצות + התראת כשל, תיקון תקלות, עדכון בשינויי API צד ג׳, עד 2 שינויים קטנים בחודש.', false, 10),
  ('automation', 'managed', 'Managed', 1400, 'כל Care + אופטימיזציה שוטפת, אוטומציה קטנה חדשה בחודש (או מכסת שעות), סקירה ודוח חודשי.', true, 20),
  ('system',     'core',  'Core',      700,  'אירוח, גיבוי, אבטחה, עדכוני תלויות, ניטור זמינות, תיקוני באגים.', false, 10),
  ('system',     'pro',   'Pro',       1800, 'כל Core + שעות פיתוח חודשיות, פיצ׳רים קטנים, אופטימיזציית ביצועים, עדיפות.', true, 20),
  ('system',     'ultra', 'Ultra VIP', 3500, 'כל Pro + SLA מהיר, שעות מובטחות, ליווי צמוד, דוחות חודשיים.', false, 30);
