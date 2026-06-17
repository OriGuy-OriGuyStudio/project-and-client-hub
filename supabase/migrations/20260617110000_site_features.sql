-- ============================================================
-- 0044 — Site features registry (admin tracking)
-- A list Ori maintains of the features in the portal: each marked "new" (manual
-- toggle) and showing whether an announcement was made about it. Used only by
-- the admin Announcements screen — clients/partners never read this table.
-- An announcement can optionally link to the feature it announces (feature_id),
-- which is how the "announced?" status is derived.
-- ============================================================

create table public.site_features (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  -- Where the feature lives / who it's for: client | partner | both | admin | general.
  area        text not null default 'general',
  -- Manual "new" flag (Ori toggles it off when it's no longer new).
  is_new      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.site_features enable row level security;

-- Admin-only: this is an internal management list.
create policy site_features_admin_all on public.site_features
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Link an announcement to the feature it announces (optional).
alter table public.announcements
  add column feature_id uuid references public.site_features on delete set null;
create index announcements_feature_idx on public.announcements (feature_id);
