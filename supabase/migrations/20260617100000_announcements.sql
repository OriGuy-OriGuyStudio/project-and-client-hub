-- ============================================================
-- 0043 — Announcements (admin-posted "what's new" banners)
-- Ori posts a short announcement (new feature / page update) targeted at
-- clients, partners, or both. It surfaces as a HeroPill banner on the relevant
-- dashboard; clicking it opens a detail modal with the full write-up and an
-- optional call-to-action link (e.g. the new landing page). Each user can
-- dismiss an announcement once; the dismissal is per-user and persisted.
-- ============================================================

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  -- Short pill label shown in the banner.
  title       text not null,
  -- Small tag shown in the pill (e.g. "✨ חדש", "🛠️ עדכון").
  badge       text not null default '✨ חדש',
  -- Full write-up shown in the detail modal when the banner is clicked.
  body        text,
  -- Who sees it. 'both' = clients and partners.
  audience    text not null default 'both' check (audience in ('client', 'partner', 'both')),
  -- Optional call-to-action link shown inside the detail modal.
  link_url    text,
  link_label  text,
  is_external boolean not null default true,
  -- Only active announcements are shown to clients/partners.
  is_active   boolean not null default true,
  created_by  uuid references public.profiles on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index announcements_active_idx on public.announcements (is_active, audience, created_at desc);

-- Per-user dismissals: an announcement a user closed should not return.
create table public.announcement_dismissals (
  announcement_id uuid not null references public.announcements on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  dismissed_at    timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;

-- ---- announcements RLS ----
-- Admin sees every row (active or not) for the management screen; everyone else
-- sees only active announcements aimed at their role (or 'both').
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_admin()
    or (is_active and audience in (public.get_my_role(), 'both'))
  );

-- Only the admin can create / edit / remove announcements.
create policy announcements_admin_insert on public.announcements
  for insert to authenticated with check (public.is_admin());
create policy announcements_admin_update on public.announcements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy announcements_admin_delete on public.announcements
  for delete to authenticated using (public.is_admin());

-- ---- announcement_dismissals RLS ----
-- A user manages only their own dismissals.
create policy dismissals_select_own on public.announcement_dismissals
  for select to authenticated using (user_id = auth.uid());
create policy dismissals_insert_own on public.announcement_dismissals
  for insert to authenticated with check (user_id = auth.uid());
create policy dismissals_delete_own on public.announcement_dismissals
  for delete to authenticated using (user_id = auth.uid());
