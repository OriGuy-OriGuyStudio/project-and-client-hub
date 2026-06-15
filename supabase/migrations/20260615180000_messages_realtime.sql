-- ============================================================
-- 0035 — Enable realtime for chat messages so the other party sees
-- new messages live. (The sender now also invalidates locally, so
-- the chat works even without this; this adds live cross-user sync.)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
