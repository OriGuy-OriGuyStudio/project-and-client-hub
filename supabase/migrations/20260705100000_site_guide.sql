-- ============================================================
-- 0079 — Site usage guide (client handover kit)
-- ============================================================
-- A per-project "how to use your website" guide the client reads in the
-- portal: login details + step-by-step how-to articles (posts, custom post
-- types, media, menus…). Studio-level TEMPLATES let Ori write the generic
-- articles once and drop them into any project, then tweak the specifics.
--
-- SECURITY: passwords are intentionally NOT stored. We keep the admin URL,
-- the username, and an optional self-service "reset password" link only.
-- ============================================================

-- ---------- studio-level template library (admin-internal) ----------
create table if not exists public.guide_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  icon text,                        -- lucide icon name (see GUIDE_ICONS in the UI)
  media_url text,                   -- optional hero image / video embed
  body_html text not null default '<p></p>',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guide_templates enable row level security;

-- Templates are an internal studio asset: admin only, never client-visible.
create policy guide_templates_all on public.guide_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- per-project guide articles ----------
create table if not exists public.guide_articles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid references public.guide_templates(id) on delete set null,
  title text not null,
  category text,
  icon text,
  media_url text,
  body_html text not null default '<p></p>',
  order_index int not null default 0,
  is_published boolean not null default true,   -- false = draft, hidden from the client
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guide_articles_project_idx on public.guide_articles(project_id);

alter table public.guide_articles enable row level security;

-- Admin manages everything; the client reads only PUBLISHED articles on their project.
create policy guide_articles_select on public.guide_articles for select to authenticated
  using (public.is_admin() or (public.owns_project(project_id) and is_published));
create policy guide_articles_write on public.guide_articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- per-project site login details (NO password) ----------
create table if not exists public.project_site_credentials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null default 'ניהול האתר',
  login_url text,
  username text,
  password_reset_url text,          -- self-service reset link (we never store the password)
  note text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_site_credentials_project_idx
  on public.project_site_credentials(project_id);

alter table public.project_site_credentials enable row level security;

create policy site_credentials_select on public.project_site_credentials for select to authenticated
  using (public.is_admin() or public.owns_project(project_id));
create policy site_credentials_write on public.project_site_credentials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- copy a studio template into a project's guide (admin) ----------
create or replace function public.apply_guide_template(p_project_id uuid, p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t guide_templates;
  v_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into v_t from guide_templates where id = p_template_id;
  if v_t.id is null then raise exception 'not_found'; end if;

  insert into guide_articles
    (project_id, template_id, title, category, icon, media_url, body_html, order_index, created_by, updated_by)
  values
    (p_project_id, v_t.id, v_t.title, v_t.category, v_t.icon, v_t.media_url, v_t.body_html,
     (select coalesce(max(order_index), -1) + 1 from guide_articles where project_id = p_project_id),
     auth.uid(), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_guide_template(uuid, uuid) from public;
grant execute on function public.apply_guide_template(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
