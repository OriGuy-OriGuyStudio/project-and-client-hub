-- ============================================================
-- 0012 — Client referral edit/delete + admin-private client CRM
-- ============================================================

-- Client may edit/delete their own referral while it's still 'submitted'.
create policy "referrals_client_update" on public.referrals
  for update to authenticated
  using (referrer_id = auth.uid() and status = 'submitted')
  with check (referrer_id = auth.uid());
create policy "referrals_client_delete" on public.referrals
  for delete to authenticated
  using (referrer_id = auth.uid() and status = 'submitted');

-- Non-admins may only edit descriptive fields, never status/deal/payment.
create or replace function public.guard_referral()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.status is distinct from old.status
      or new.deal_value is distinct from old.deal_value
      or new.payment_method is distinct from old.payment_method
      or new.payment_confirmed_at is distinct from old.payment_confirmed_at
      or new.referrer_id is distinct from old.referrer_id then
      raise exception 'אין הרשאה לעדכן שדות אלה';
    end if;
  end if;
  return new;
end;
$$;
create trigger referrals_guard
  before update on public.referrals
  for each row execute function public.guard_referral();

-- Deleting a referral reverses any credits it granted (no farming).
create or replace function public.reverse_referral_credit()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.credit_transactions where referral_id = old.id;
  return old;
end;
$$;
create trigger referrals_reverse_credit
  before delete on public.referrals
  for each row execute function public.reverse_referral_credit();

-- Admin-private CRM info per client.
alter table public.admin_client_notes add column if not exists gender text
  check (gender in ('male','female','other'));
alter table public.admin_client_notes add column if not exists role_in_company text;

create table public.client_call_logs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles on delete cascade,
  summary    text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null
);
create index client_call_logs_client_idx on public.client_call_logs (client_id, created_at desc);

alter table public.client_call_logs enable row level security;
create policy "client_call_logs_admin" on public.client_call_logs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
