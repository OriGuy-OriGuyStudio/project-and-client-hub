-- ============================================================
-- 0068 — Discovery / characterization call sessions (admin-only)
-- Ori documents a structured intake call with a client (fixed questions per
-- template). Each session can produce a public, token-gated summary URL that
-- shows only the answers Ori flagged as client-visible + a written summary.
-- ============================================================

create table if not exists public.discovery_sessions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.profiles on delete set null,
  project_id    uuid references public.projects on delete set null,
  title         text not null,
  template_key  text not null default 'landing',
  -- { [questionId]: { "value": text, "show": bool } }
  answers       jsonb not null default '{}'::jsonb,
  client_summary text,                 -- the curated summary shown to the client
  follow_up      text,                 -- internal: important points for follow-up
  status        text not null default 'draft' check (status in ('draft', 'done')),
  share_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists discovery_sessions_client_idx
  on public.discovery_sessions (client_id);

alter table public.discovery_sessions enable row level security;

-- Admin only — clients/partners never touch this table directly.
create policy "discovery_admin" on public.discovery_sessions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Public, token-gated read of the CLIENT-SAFE summary (anon-callable). Returns
-- only the written summary + the answers flagged show=true; never the internal
-- follow-up notes or hidden answers.
create or replace function public.get_discovery_summary(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.discovery_sessions;
  shown jsonb;
begin
  select * into s from public.discovery_sessions where share_token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_object_agg(key, value -> 'value'), '{}'::jsonb)
  into shown
  from jsonb_each(s.answers)
  where coalesce((value ->> 'show')::boolean, false) = true
    and coalesce(value ->> 'value', '') <> '';

  return jsonb_build_object(
    'title', s.title,
    'template_key', s.template_key,
    'client_summary', s.client_summary,
    'answers', shown,
    'created_at', s.created_at
  );
end;
$$;

grant execute on function public.get_discovery_summary(text) to anon, authenticated;
