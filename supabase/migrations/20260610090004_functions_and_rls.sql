-- ============================================================
-- 0004 — Deferred functions + RLS on EVERY table (security core)
-- ============================================================
-- Pattern:
--   * is_admin() short-circuits to full access.
--   * Clients are scoped to their own rows via auth.uid() / owns_project().
--   * is_private rows are blocked at the DB level for clients (files, tasks,
--     project_docs) — never merely hidden in the UI.
--   * Immutable tables (activity_log, credit_transactions) get no UPDATE/DELETE
--     policy, so those commands are denied by default.
--   * Every policy targets the `authenticated` role; anon gets nothing.
-- ============================================================

-- ---- Functions that depend on tables from 0002/0003 --------
create or replace function public.get_client_credits(p_client_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int
  from public.credit_transactions
  where client_id = p_client_id;
$$;

create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and client_id = auth.uid()
  );
$$;

-- Prevent a client from escalating their own role; only admins change roles.
create or replace function public.enforce_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'אין הרשאה לשנות תפקיד';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.enforce_profile_role();

-- ============================================================
-- profiles
-- ============================================================
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles_admin_write" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- allowed_emails — admin only
-- ============================================================
alter table public.allowed_emails enable row level security;

create policy "allowed_emails_admin" on public.allowed_emails
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- client_brand
-- ============================================================
alter table public.client_brand enable row level security;

create policy "client_brand_select" on public.client_brand
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

create policy "client_brand_admin_write" on public.client_brand
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- brand_colors
-- ============================================================
alter table public.brand_colors enable row level security;

create policy "brand_colors_select" on public.brand_colors
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

create policy "brand_colors_admin_write" on public.brand_colors
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- projects
-- ============================================================
alter table public.projects enable row level security;

create policy "projects_select" on public.projects
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

create policy "projects_admin_write" on public.projects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- project_stages
-- ============================================================
alter table public.project_stages enable row level security;

create policy "project_stages_select" on public.project_stages
  for select to authenticated
  using (public.owns_project(project_id) or public.is_admin());

create policy "project_stages_admin_write" on public.project_stages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- approvals — client may approve / leave notes on own project
-- ============================================================
alter table public.approvals enable row level security;

create policy "approvals_select" on public.approvals
  for select to authenticated
  using (public.owns_project(project_id) or public.is_admin());

create policy "approvals_client_update" on public.approvals
  for update to authenticated
  using (public.owns_project(project_id) or public.is_admin())
  with check (public.owns_project(project_id) or public.is_admin());

create policy "approvals_admin_insert" on public.approvals
  for insert to authenticated
  with check (public.is_admin());

create policy "approvals_admin_delete" on public.approvals
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- files — private files blocked at DB level for clients
-- ============================================================
alter table public.files enable row level security;

create policy "files_select" on public.files
  for select to authenticated
  using ((not is_private and public.owns_project(project_id)) or public.is_admin());

create policy "files_insert" on public.files
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.owns_project(project_id) and is_private = false and uploaded_by = auth.uid())
  );

create policy "files_delete" on public.files
  for delete to authenticated
  using (
    public.is_admin()
    or (uploaded_by = auth.uid() and not is_private and public.owns_project(project_id))
  );

create policy "files_admin_update" on public.files
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- checklist_items — client toggles "sent" on own project
-- ============================================================
alter table public.checklist_items enable row level security;

create policy "checklist_select" on public.checklist_items
  for select to authenticated
  using (public.owns_project(project_id) or public.is_admin());

create policy "checklist_client_update" on public.checklist_items
  for update to authenticated
  using (public.owns_project(project_id) or public.is_admin())
  with check (public.owns_project(project_id) or public.is_admin());

create policy "checklist_admin_insert" on public.checklist_items
  for insert to authenticated
  with check (public.is_admin());

create policy "checklist_admin_delete" on public.checklist_items
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- tasks — private tasks blocked at DB level for clients
-- ============================================================
alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks
  for select to authenticated
  using ((not is_private and public.owns_project(project_id)) or public.is_admin());

create policy "tasks_client_update" on public.tasks
  for update to authenticated
  using ((public.owns_project(project_id) and not is_private) or public.is_admin())
  with check ((public.owns_project(project_id) and not is_private) or public.is_admin());

create policy "tasks_admin_insert" on public.tasks
  for insert to authenticated
  with check (public.is_admin());

create policy "tasks_admin_delete" on public.tasks
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- project_docs — both sides edit non-private docs on own project
-- ============================================================
alter table public.project_docs enable row level security;

create policy "project_docs_select" on public.project_docs
  for select to authenticated
  using ((not is_private and public.owns_project(project_id)) or public.is_admin());

create policy "project_docs_insert" on public.project_docs
  for insert to authenticated
  with check (public.is_admin() or (public.owns_project(project_id) and is_private = false));

create policy "project_docs_update" on public.project_docs
  for update to authenticated
  using (public.is_admin() or (public.owns_project(project_id) and not is_private))
  with check (public.is_admin() or (public.owns_project(project_id) and not is_private));

create policy "project_docs_admin_delete" on public.project_docs
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- payments — admin writes, client reads own
-- ============================================================
alter table public.payments enable row level security;

create policy "payments_select" on public.payments
  for select to authenticated
  using (public.owns_project(project_id) or public.is_admin());

create policy "payments_admin_write" on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- messages — participants of a project
-- ============================================================
alter table public.messages enable row level security;

create policy "messages_select" on public.messages
  for select to authenticated
  using (public.owns_project(project_id) or public.is_admin());

create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and (public.owns_project(project_id) or public.is_admin()));

create policy "messages_update_read" on public.messages
  for update to authenticated
  using (public.owns_project(project_id) or public.is_admin())
  with check (public.owns_project(project_id) or public.is_admin());

create policy "messages_admin_delete" on public.messages
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- activity_log — readable by both, immutable (no update/delete)
-- ============================================================
alter table public.activity_log enable row level security;

create policy "activity_log_select" on public.activity_log
  for select to authenticated
  using (public.owns_project(project_id) or public.is_admin());

create policy "activity_log_insert" on public.activity_log
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.owns_project(project_id) and actor_id = auth.uid())
  );

-- ============================================================
-- admin_client_notes — admin only, always
-- ============================================================
alter table public.admin_client_notes enable row level security;

create policy "admin_client_notes_admin" on public.admin_client_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- partner_enrollments — self-enroll, read own
-- ============================================================
alter table public.partner_enrollments enable row level security;

create policy "partner_enrollments_select" on public.partner_enrollments
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

create policy "partner_enrollments_insert" on public.partner_enrollments
  for insert to authenticated
  with check (client_id = auth.uid() or public.is_admin());

create policy "partner_enrollments_update" on public.partner_enrollments
  for update to authenticated
  using (client_id = auth.uid() or public.is_admin())
  with check (client_id = auth.uid() or public.is_admin());

create policy "partner_enrollments_admin_delete" on public.partner_enrollments
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- referrals — referrer submits + reads own; admin manages status
-- ============================================================
alter table public.referrals enable row level security;

create policy "referrals_select" on public.referrals
  for select to authenticated
  using (referrer_id = auth.uid() or public.is_admin());

create policy "referrals_client_insert" on public.referrals
  for insert to authenticated
  with check (referrer_id = auth.uid() or public.is_admin());

create policy "referrals_admin_update" on public.referrals
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "referrals_admin_delete" on public.referrals
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- credit_transactions — immutable ledger; insert admin-only
-- ============================================================
alter table public.credit_transactions enable row level security;

create policy "credit_transactions_select" on public.credit_transactions
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

create policy "credit_transactions_admin_insert" on public.credit_transactions
  for insert to authenticated
  with check (public.is_admin());

-- ============================================================
-- rewards — catalog readable by all authenticated; admin writes
-- ============================================================
alter table public.rewards enable row level security;

create policy "rewards_select" on public.rewards
  for select to authenticated
  using (true);

create policy "rewards_admin_write" on public.rewards
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- reward_redemptions — read own; writes via admin / definer RPC
-- ============================================================
alter table public.reward_redemptions enable row level security;

create policy "reward_redemptions_select" on public.reward_redemptions
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

create policy "reward_redemptions_admin_write" on public.reward_redemptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
