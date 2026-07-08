-- ============================================================
-- 0085 — time sessions can attach to a client (even with no project)
-- ============================================================
-- Lets the admin track pre-project time per client (sales, discovery, quotes)
-- before a project exists. client_id is nullable; once a project is created the
-- session can be edited to attach to it. project_id already implies a client,
-- so client_id is mainly for the "client but no project yet" case.
-- ============================================================

alter table public.time_sessions
  add column if not exists client_id uuid references public.profiles(id) on delete set null;
create index if not exists time_sessions_client_idx on public.time_sessions (client_id);

notify pgrst, 'reload schema';
