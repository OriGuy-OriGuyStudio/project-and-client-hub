-- Agreement addenda ("נספחים"): a signed service agreement is a frozen
-- snapshot and must never be rewritten, so when a term needs to change (a new
-- clause like domain management, a price change, a scope note) the studio issues
-- an ADDENDUM , a small standalone document, its own sign link and signature,
-- linked to the parent agreement. Mirrors the service_agreements pattern:
-- immutable body frozen at creation, a public token to sign, admin-notified on
-- signature, and locked once signed.

create table if not exists public.agreement_addenda (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.service_agreements(id) on delete cascade,
  client_id     uuid references public.profiles(id) on delete set null,
  -- Public token for the sign link; opaque, like the landing invite token.
  sign_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  title         text not null,
  -- The clause text, frozen at creation. Editing it before signing replaces it;
  -- after signing it is locked by the guard below.
  body          text not null,
  status        text not null default 'pending' check (status in ('pending', 'signed')),
  signer_name   text,
  signature     text,
  signature_image text,
  consent_accepted boolean not null default false,
  gender        text not null default 'male' check (gender in ('male', 'female')),
  created_at    timestamptz not null default now(),
  signed_at     timestamptz
);

create index if not exists agreement_addenda_agreement_idx on public.agreement_addenda (agreement_id);
create index if not exists agreement_addenda_client_idx on public.agreement_addenda (client_id);

alter table public.agreement_addenda enable row level security;

-- Admins read/manage everything; clients read their own addenda (so they show
-- in the portal). Public signing goes ONLY through the definer RPCs below, so
-- there is deliberately no anon policy and no public insert/update policy.
drop policy if exists addenda_admin_all on public.agreement_addenda;
create policy addenda_admin_all on public.agreement_addenda
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists addenda_client_read on public.agreement_addenda;
create policy addenda_client_read on public.agreement_addenda
  for select using (client_id = auth.uid());

-- Once signed, the document is legal evidence , block edits and deletes to the
-- frozen fields. Admin may still delete a PENDING addendum (handled by the
-- delete RPC, which checks status), but a signed one is immutable.
create or replace function public.guard_signed_addendum()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status = 'signed' then
      raise exception 'אי אפשר למחוק נספח חתום';
    end if;
    return OLD;
  end if;
  if OLD.status = 'signed' then
    -- allow no changes at all once signed
    raise exception 'הנספח כבר נחתם ואי אפשר לשנות אותו';
  end if;
  return NEW;
end $$;

drop trigger if exists guard_signed_addendum on public.agreement_addenda;
create trigger guard_signed_addendum before update or delete on public.agreement_addenda
  for each row execute function public.guard_signed_addendum();

-- ---- admin: create an addendum for an existing agreement -------------------
create or replace function public.admin_create_addendum(p_agreement_id uuid, p_title text, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_id uuid;
  v_token text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'title and body required';
  end if;

  select client_id into v_client from public.service_agreements where id = p_agreement_id;

  insert into public.agreement_addenda (agreement_id, client_id, title, body)
  values (p_agreement_id, v_client, left(btrim(p_title), 200), btrim(p_body))
  returning id, sign_token into v_id, v_token;

  return jsonb_build_object('ok', true, 'id', v_id, 'sign_token', v_token);
end $$;

-- ---- admin: edit / delete a PENDING addendum ------------------------------
create or replace function public.admin_update_addendum(p_id uuid, p_title text, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.agreement_addenda
    set title = left(btrim(p_title), 200), body = btrim(p_body)
    where id = p_id and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_addendum(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.agreement_addenda where id = p_id and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---- public: read an addendum by its sign token (the sign page) ------------
-- Returns the addendum plus a little parent-agreement context to show who it is
-- for. No signature image is returned to the public read (not needed to sign).
create or replace function public.get_addendum_public(p_token text)
returns json
language sql security definer stable set search_path = public as $$
  select json_build_object(
    'id', ad.id,
    'title', ad.title,
    'body', ad.body,
    'status', ad.status,
    'signer_name', ad.signer_name,
    'gender', ad.gender,
    'created_at', ad.created_at,
    'signed_at', ad.signed_at,
    'business', sa.business,
    'tier', sa.tier,
    'client_name', sa.full_name
  )
  from public.agreement_addenda ad
  join public.service_agreements sa on sa.id = ad.agreement_id
  where ad.sign_token = p_token;
$$;

-- ---- public: sign an addendum ---------------------------------------------
create or replace function public.sign_addendum(p_token text, p_payload json)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_client uuid;
  v_status text;
begin
  select id, client_id, status into v_id, v_client, v_status
    from public.agreement_addenda where sign_token = p_token;
  if v_id is null then return json_build_object('ok', false, 'error', 'not_found'); end if;

  update public.agreement_addenda set
    signer_name = nullif(left(coalesce(p_payload->>'signer_name', ''), 120), ''),
    signature = nullif(left(coalesce(p_payload->>'signature', ''), 120), ''),
    signature_image = nullif(p_payload->>'signature_image', ''),
    consent_accepted = coalesce((p_payload->>'consent_accepted')::boolean, false),
    gender = case when p_payload->>'gender' in ('male','female') then p_payload->>'gender' else 'male' end,
    status = 'signed',
    signed_at = now()
  where sign_token = p_token and status = 'pending';

  if not found then return json_build_object('ok', false, 'error', 'already_signed'); end if;

  perform notify_admin(
    'service_agreement',
    'נחתם נספח להסכם',
    coalesce(nullif(p_payload->>'signer_name', ''), 'הלקוח') || ' חתם על נספח',
    case when v_client is not null then '/admin/clients/' || v_client::text else '/admin' end,
    null,
    v_id
  );

  return json_build_object('ok', true);
end $$;

-- ---- admin: list a client's / agreement's addenda -------------------------
create or replace function public.admin_agreement_addenda(p_agreement_id uuid)
returns setof public.agreement_addenda
language sql security definer stable set search_path = public as $$
  select * from public.agreement_addenda
  where p_agreement_id is null or agreement_id = p_agreement_id
  order by created_at desc;
$$;

revoke all on function public.admin_create_addendum(uuid, text, text) from public, anon;
revoke all on function public.admin_update_addendum(uuid, text, text) from public, anon;
revoke all on function public.admin_delete_addendum(uuid) from public, anon;
revoke all on function public.admin_agreement_addenda(uuid) from public, anon;
grant execute on function public.admin_create_addendum(uuid, text, text) to authenticated;
grant execute on function public.admin_update_addendum(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_addendum(uuid) to authenticated;
grant execute on function public.admin_agreement_addenda(uuid) to authenticated;
grant execute on function public.get_addendum_public(text) to anon, authenticated;
grant execute on function public.sign_addendum(text, json) to anon, authenticated;

notify pgrst, 'reload schema';
