-- ============================================================
-- 0081 — Admin time tracking (timer)
-- ============================================================
-- A personal time tracker for the admin (Ori): sessions attached either to a
-- project stage (pulled from the project's real roadmap) or to a personal
-- label. Plus a per-project "value" used to show effective ₪/hour.
--
-- ADMIN-ONLY, non-negotiable: every table blocks non-admins entirely at the
-- RLS layer, so none of this is ever exposed to a client. Project value lives
-- in its own admin-only table (NOT on `projects`, which clients can read).
-- ============================================================

-- ---------- reusable personal labels (studio-level) ----------
create table if not exists public.time_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists time_labels_name_uidx on public.time_labels (lower(name));
alter table public.time_labels enable row level security;
create policy time_labels_admin on public.time_labels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- tracked sessions ----------
create table if not exists public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('stage','personal')),
  project_id uuid references public.projects(id) on delete set null,
  stage_id uuid references public.project_stages(id) on delete set null,
  label text,                                   -- for kind='personal'
  mode text not null default 'up' check (mode in ('up','down')),
  planned_seconds int,                          -- for countdown / pomodoro
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists time_sessions_owner_idx on public.time_sessions (owner_id);
create index if not exists time_sessions_project_idx on public.time_sessions (project_id);
create index if not exists time_sessions_stage_idx on public.time_sessions (stage_id);
alter table public.time_sessions enable row level security;
create policy time_sessions_admin on public.time_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- per-project value (admin-only, hidden from clients) ----------
create table if not exists public.project_billing (
  project_id uuid primary key references public.projects(id) on delete cascade,
  value numeric,
  currency text not null default 'ILS',
  updated_at timestamptz not null default now()
);
alter table public.project_billing enable row level security;
create policy project_billing_admin on public.project_billing for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- seed the studio's default personal labels ----------
insert into public.time_labels (name, order_index) values
  ('שיווק',0),('מכירות ולידים',1),('הצעות מחיר',2),('פגישות לקוח',3),
  ('למידה',4),('תוכן וכתיבה',5),('סושיאל',6),('עיצוב / מחקר',7),
  ('ניהול ואדמין',8),('כספים והנהח״ש',9),('תמיכה ותחזוקה',10),('מיילים',11),
  ('פיתוח עסקי',12),('מנוחה / הפסקות',13),('ספורט / בריאות',14),('פלייסטיישן',15)
on conflict do nothing;

notify pgrst, 'reload schema';
