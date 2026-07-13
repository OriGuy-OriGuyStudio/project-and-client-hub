-- ============================================================
-- Content-collection brief ("בריף תוכן ותמונות"):
--   * The brief STRUCTURE is a `brief` project_deliverable (AI-generated, admin
--     curated, published to the client) — reuses project_deliverables.
--   * The client's ANSWERS live in brief_responses (one row per item), which the
--     client can write (text + uploaded file refs + a done flag). Uploaded files
--     go through the normal project-files system, so they also show in "קבצים".
-- ============================================================

-- 1. Allow the new 'brief' deliverable kind.
alter table public.project_deliverables
  drop constraint if exists project_deliverables_kind_check;
alter table public.project_deliverables
  add constraint project_deliverables_kind_check
  check (kind = any (array['persona','journey','sitemap','copy','brief']));

-- 2. Client answers to the brief.
create table if not exists public.brief_responses (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  org_id      uuid references public.organizations on delete set null,
  item_id     text not null,                       -- the item uuid from the brief content jsonb
  text        text,
  files       jsonb not null default '[]'::jsonb,  -- [{path,name,mime,size}]
  done        boolean not null default false,
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  unique (project_id, item_id)
);

create index if not exists brief_responses_project_idx on public.brief_responses (project_id);

alter table public.brief_responses enable row level security;

-- Admin: full access.
create policy "brief_responses_admin" on public.brief_responses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Client (any org member of the project): read their project's responses.
create policy "brief_responses_client_read" on public.brief_responses
  for select to authenticated
  using (public.can_access_project(project_id));

-- Client: create a response for their own project (stamped with their uid).
create policy "brief_responses_client_insert" on public.brief_responses
  for insert to authenticated
  with check (public.can_access_project(project_id) and updated_by = auth.uid());

-- Client: update responses of their own project.
create policy "brief_responses_client_update" on public.brief_responses
  for update to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id) and updated_by = auth.uid());

-- 3. Notify the admin when the client marks an item as done (mirrors checklist).
create or replace function public.notify_brief()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_p text;
begin
  if not public.is_admin() and new.done and (tg_op = 'INSERT' or not coalesce(old.done, false)) then
    select title into v_p from public.projects where id = new.project_id;
    perform public.notify_admin('brief', 'חומר לאתר הוגש · ' || coalesce(v_p, 'פרויקט'),
      'הלקוח סימן פריט כהושלם בבריף התוכן', '/projects/' || new.project_id, new.project_id, new.id);
  end if;
  return new;
end; $function$;

create trigger brief_responses_notify
  after insert or update on public.brief_responses
  for each row execute function public.notify_brief();
