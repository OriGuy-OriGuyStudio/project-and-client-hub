-- ============================================================
-- 0066 — Mark a task note as "to tell the client" + track whether it was told
-- Private board, so these are just Ori's own flags: a note can be private or
-- something he needs to convey to the client, and he can tick it once done.
-- ============================================================

alter table public.admin_tasks
  add column if not exists note_for_client boolean not null default false,
  add column if not exists client_informed boolean not null default false;
