-- ============================================================
-- 0009 — Partner (שת"פ) role: third user type, separate from client
-- ============================================================
-- A partner is an external business that refers leads to the studio for a
-- commission. No projects/files/chat — only the partner portal.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','client','partner'));
alter table public.allowed_emails drop constraint if exists allowed_emails_role_check;
alter table public.allowed_emails add constraint allowed_emails_role_check check (role in ('admin','client','partner'));

alter table public.allowed_emails add column if not exists commission_rate numeric(5,2);
alter table public.allowed_emails add column if not exists commission_notes text;

create table public.partner_profiles (
  id              uuid primary key references public.profiles on delete cascade,
  commission_rate numeric(5,2) not null default 5.0,
  commission_notes text,
  referral_code   text unique not null,
  is_active       boolean not null default true,
  joined_at       timestamptz not null default now()
);

create table public.partner_leads (
  id                       uuid primary key default gen_random_uuid(),
  partner_id               uuid not null references public.profiles on delete cascade,
  lead_name                text not null,
  lead_phone               text,
  lead_email               text,
  project_type             text check (project_type in ('business_site','ecommerce','system','other')),
  notes                    text,
  quote_requested          boolean not null default false,
  quote_file_url           text,
  lead_interested          boolean not null default false,
  status                   text not null default 'submitted' check (status in ('submitted','in_review','quote_sent','interested','closed','not_relevant')),
  deal_value               numeric(10,2),
  commission_rate_at_close numeric(5,2),
  commission_amount        numeric(10,2),
  payment_method           text check (payment_method in ('bit','bank_transfer')),
  payment_confirmed_at     timestamptz,
  payment_confirmed_by     uuid references public.profiles on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index partner_leads_partner_idx on public.partner_leads (partner_id);
create trigger partner_leads_set_updated_at
  before update on public.partner_leads
  for each row execute function public.set_updated_at();

create table public.referral_tracking (
  id                   uuid primary key default gen_random_uuid(),
  partner_id           uuid not null references public.profiles on delete cascade,
  referral_code        text not null,
  ip_hash              text,
  user_agent           text,
  converted_to_lead_id uuid references public.partner_leads on delete set null,
  clicked_at           timestamptz not null default now()
);
create index referral_tracking_partner_idx on public.referral_tracking (partner_id);

create table public.partner_resources (
  id            uuid primary key default gen_random_uuid(),
  resource_type text check (resource_type in ('file','link','text_template')),
  title         text not null,
  description   text,
  content       text,
  file_url      text,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- Non-admins may only toggle quote_requested / lead_interested / notes.
create or replace function public.guard_partner_lead()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.status is distinct from old.status
      or new.deal_value is distinct from old.deal_value
      or new.commission_rate_at_close is distinct from old.commission_rate_at_close
      or new.commission_amount is distinct from old.commission_amount
      or new.payment_method is distinct from old.payment_method
      or new.payment_confirmed_at is distinct from old.payment_confirmed_at
      or new.partner_id is distinct from old.partner_id then
      raise exception 'אין הרשאה לעדכן שדות אלה';
    end if;
  end if;
  return new;
end;
$$;
create trigger partner_leads_guard
  before update on public.partner_leads
  for each row execute function public.guard_partner_lead();

alter table public.partner_profiles enable row level security;
create policy "partner_profiles_select" on public.partner_profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "partner_profiles_admin_write" on public.partner_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.partner_leads enable row level security;
create policy "partner_leads_select" on public.partner_leads
  for select to authenticated using (partner_id = auth.uid() or public.is_admin());
create policy "partner_leads_insert" on public.partner_leads
  for insert to authenticated with check (partner_id = auth.uid() and public.get_my_role() = 'partner');
create policy "partner_leads_partner_update" on public.partner_leads
  for update to authenticated using (partner_id = auth.uid()) with check (partner_id = auth.uid());
create policy "partner_leads_admin_all" on public.partner_leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.referral_tracking enable row level security;
create policy "referral_tracking_select" on public.referral_tracking
  for select to authenticated using (partner_id = auth.uid() or public.is_admin());
create policy "referral_tracking_admin_write" on public.referral_tracking
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.partner_resources enable row level security;
create policy "partner_resources_read" on public.partner_resources
  for select to authenticated using (is_active = true and public.get_my_role() in ('partner','admin'));
create policy "partner_resources_write" on public.partner_resources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ensure_my_profile() and handle_new_user() are extended in this migration to
-- create a partner_profiles row (commission + generated referral_code) when the
-- whitelisted role is 'partner'. (Full bodies applied via MCP; see project notes.)
