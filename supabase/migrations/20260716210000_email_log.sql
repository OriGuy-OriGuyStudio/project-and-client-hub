-- Central log of every email the system sends (Ori: "אני צריך לדעת מה נשלח
-- ומתי"). Written by the Edge Function mailers with the service role right
-- after each Gmail attempt, success or failure, so a failed send is recorded
-- rather than lost. Admin-only for reads; nobody but the service role writes.
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                 -- which mailer: notify-lead-status, send-invite...
  to_email    text not null,
  subject     text not null,
  html        text,                          -- exact body as sent
  ok          boolean not null default false,
  error       text,                          -- gmail status/detail when ok = false
  context     jsonb not null default '{}'::jsonb,  -- ids the mailer knows (lead, project, status...)
  created_at  timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_kind_idx on public.email_log (kind);

alter table public.email_log enable row level security;

-- Admins read; writes come only from Edge Functions using the service role
-- (which bypasses RLS), so there is deliberately no insert policy.
drop policy if exists email_log_admin_read on public.email_log;
create policy email_log_admin_read on public.email_log
  for select using (public.is_admin());

drop policy if exists email_log_admin_delete on public.email_log;
create policy email_log_admin_delete on public.email_log
  for delete using (public.is_admin());
