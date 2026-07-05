-- ============================================================
-- 0076 — Demo-account clone / reset (admin QA tooling)
-- ============================================================
-- Lets the admin load a real client's/partner's data INTO a demo
-- account (origuydev@ = client, origuy2018@ = partner) so Ori can log
-- in as the demo and experience exactly what that user sees, then
-- RESET the demo back to an empty state.
--
-- Safety:
--  * Both RPCs are admin-only (is_admin()) and refuse to touch any
--    account that isn't one of the whitelisted demo emails.
--  * They NEVER modify the source user's rows (read-only on source).
--  * Side-effect triggers (notify / reward / grant / reverse-credit /
--    anti-spam guards / updated_at) are disabled for the duration so the
--    copy/delete reproduce the source state exactly without firing emails,
--    granting coins/credits, or being blocked by dedup guards. A rollback
--    on error re-enables them automatically (ALTER TABLE is transactional).
--  * v1 does NOT copy project FILE blobs (the private project-files bucket
--    is path-scoped by project id). The demo's Files section is empty until
--    a follow-up adds server-side blob copy. Public brand logos still show
--    (brand-assets is a public bucket).
--
-- ⚠️ Keep the demo email list in sync with src/lib/demo.ts (DEMO_EMAILS).
-- ============================================================

create or replace function public.is_demo_account(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = p_uid
      and lower(email) in ('origuydev@gmail.com', 'origuy2018@gmail.com')
  );
$$;

-- Disable the side-effect triggers we don't want firing during a bulk
-- copy/delete. Owned by postgres (table owner) so it can ALTER.
create or replace function public._demo_suspend_triggers(p_enable boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := case when p_enable then 'ENABLE' else 'DISABLE' end;
  v_tbl text;
begin
  foreach v_tbl in array array[
    'approvals','checklist_items','messages','partner_leads','referrals',
    'projects','project_docs','stage_tasks'
  ] loop
    execute format('alter table public.%I %s trigger user', v_tbl, v_action);
  end loop;
end;
$$;

-- ---------- RESET ----------
create or replace function public.reset_demo_account(p_demo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not is_demo_account(p_demo) then raise exception 'not_demo_account'; end if;
  select role into v_role from profiles where id = p_demo;

  perform _demo_suspend_triggers(false);

  -- Client-owned (projects cascade to stages/tasks/files/payments/approvals/
  -- checklist/docs/folders/messages/activity).
  delete from projects where client_id = p_demo;
  delete from credit_transactions where client_id = p_demo;
  delete from referrals where referrer_id = p_demo;
  delete from reward_redemptions where client_id = p_demo;
  delete from brand_colors where client_id = p_demo;
  delete from client_brand where client_id = p_demo;

  -- Partner-owned.
  delete from partner_coin_transactions where partner_id = p_demo;
  delete from partner_leads where partner_id = p_demo;
  delete from partner_reward_redemptions where partner_id = p_demo;

  -- Restore demo identity + partner commission defaults.
  if v_role = 'partner' then
    update profiles set full_name = 'שותף דמה (טסט)', gender = null where id = p_demo;
    update partner_profiles set
      commission_rate = 5, commission_rate_min = 5, commission_rate_max = 5,
      commission_notes = null, tier = 'bronze', tier_locked = false,
      boost_pct = 0, boost_deals_left = 0
      where id = p_demo;
  else
    update profiles set full_name = 'לקוח דמה (טסט)', gender = null where id = p_demo;
  end if;

  perform _demo_suspend_triggers(true);
end;
$$;

-- ---------- CLONE ----------
create or replace function public.clone_into_demo(p_demo uuid, p_source uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demo_role text;
  v_src_role text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not is_demo_account(p_demo) then raise exception 'not_demo_account'; end if;
  if p_demo = p_source then raise exception 'source_is_demo'; end if;

  select role into v_demo_role from profiles where id = p_demo;
  select role into v_src_role from profiles where id = p_source;
  if v_src_role is null then raise exception 'no_source'; end if;
  if v_demo_role <> v_src_role then raise exception 'role_mismatch'; end if;

  -- Start from a clean slate (this re-enables triggers at its end).
  perform reset_demo_account(p_demo);
  perform _demo_suspend_triggers(false);

  -- Copy the display name (login/email stays the demo's own).
  update profiles d
    set full_name = s.full_name, gender = s.gender
    from profiles s
    where d.id = p_demo and s.id = p_source;

  if v_src_role = 'partner' then
    -- Commission settings (keep the demo's own referral_code / is_active).
    update partner_profiles d set
      commission_rate = s.commission_rate,
      commission_notes = s.commission_notes,
      commission_rate_min = s.commission_rate_min,
      commission_rate_max = s.commission_rate_max,
      tier = s.tier, tier_locked = s.tier_locked,
      boost_pct = s.boost_pct, boost_deals_left = s.boost_deals_left
      from partner_profiles s
      where d.id = p_demo and s.id = p_source;

    create temp table _lmap (old uuid primary key, new uuid not null default gen_random_uuid()) on commit drop;
    insert into _lmap(old) select id from partner_leads where partner_id = p_source;

    insert into partner_leads (id, partner_id, lead_name, lead_phone, lead_email, project_type,
      notes, quote_requested, quote_file_url, lead_interested, status, deal_value,
      commission_rate_at_close, commission_amount, payment_method, payment_confirmed_at,
      payment_confirmed_by, created_at, updated_at)
    select m.new, p_demo, l.lead_name, l.lead_phone, l.lead_email, l.project_type,
      l.notes, l.quote_requested, l.quote_file_url, l.lead_interested, l.status, l.deal_value,
      l.commission_rate_at_close, l.commission_amount, l.payment_method, l.payment_confirmed_at,
      l.payment_confirmed_by, l.created_at, l.updated_at
    from partner_leads l join _lmap m on m.old = l.id;

    insert into partner_coin_transactions (id, partner_id, amount, reason, lead_id, note, created_at)
    select gen_random_uuid(), p_demo, ct.amount, ct.reason, m.new, ct.note, ct.created_at
    from partner_coin_transactions ct left join _lmap m on m.old = ct.lead_id
    where ct.partner_id = p_source;

    insert into partner_reward_redemptions (id, partner_id, reward_id, coins_spent, status, note, created_at, fulfilled_at)
    select gen_random_uuid(), p_demo, rr.reward_id, rr.coins_spent, rr.status, rr.note, rr.created_at, rr.fulfilled_at
    from partner_reward_redemptions rr where rr.partner_id = p_source;

  else
    -- ----- CLIENT -----
    -- Brand (logos live in the PUBLIC brand-assets bucket → show as-is).
    insert into client_brand (id, client_id, business_name, business_description, logo_url,
      logo_icon_url, font_notes, website_url, social_links, updated_at, logo_fit)
    select gen_random_uuid(), p_demo, b.business_name, b.business_description, b.logo_url,
      b.logo_icon_url, b.font_notes, b.website_url, b.social_links, b.updated_at, b.logo_fit
    from client_brand b where b.client_id = p_source;

    insert into brand_colors (id, client_id, hex_value, label, role, sort_order)
    select gen_random_uuid(), p_demo, c.hex_value, c.label, c.role, c.sort_order
    from brand_colors c where c.client_id = p_source;

    -- Projects + every project-scoped child (UUIDs remapped, ownership flipped).
    create temp table _pmap (old uuid primary key, new uuid not null default gen_random_uuid()) on commit drop;
    insert into _pmap(old) select id from projects where client_id = p_source;

    -- warranty_end_date is a generated column → omit it.
    insert into projects (id, title, description, client_id, status, figma_url, staging_url,
      live_url, warranty_start_date, warranty_email_sent, created_at,
      updated_at, figma_prototype_url, meeting_url)
    select m.new, p.title, p.description, p_demo, p.status, p.figma_url, p.staging_url,
      p.live_url, p.warranty_start_date, p.warranty_email_sent, p.created_at,
      p.updated_at, p.figma_prototype_url, p.meeting_url
    from projects p join _pmap m on m.old = p.id;

    create temp table _smap (old uuid primary key, new uuid not null default gen_random_uuid()) on commit drop;
    insert into _smap(old) select s.id from project_stages s join _pmap pm on pm.old = s.project_id;

    insert into project_stages (id, project_id, title, assignee, due_date, status, order_index)
    select sm.new, pm.new, s.title, s.assignee, s.due_date, s.status, s.order_index
    from project_stages s join _pmap pm on pm.old = s.project_id join _smap sm on sm.old = s.id;

    insert into stage_tasks (id, stage_id, title, is_done, order_index, created_at, status)
    select gen_random_uuid(), sm.new, t.title, t.is_done, t.order_index, t.created_at, t.status
    from stage_tasks t join _smap sm on sm.old = t.stage_id;

    insert into tasks (id, project_id, title, description, assignee_id, due_date, status, is_private, created_at)
    select gen_random_uuid(), pm.new, t.title, t.description, t.assignee_id, t.due_date, t.status, t.is_private, t.created_at
    from tasks t join _pmap pm on pm.old = t.project_id;

    insert into payments (id, project_id, label, amount, currency, due_date, status, payment_link, invoice_file_id, paid_at)
    select gen_random_uuid(), pm.new, p.label, p.amount, p.currency, p.due_date, p.status, p.payment_link, null, p.paid_at
    from payments p join _pmap pm on pm.old = p.project_id;

    insert into approvals (id, project_id, title, description, status, client_notes, created_at, updated_at)
    select gen_random_uuid(), pm.new, a.title, a.description, a.status, a.client_notes, a.created_at, a.updated_at
    from approvals a join _pmap pm on pm.old = a.project_id;

    insert into checklist_items (id, project_id, label, is_sent, sent_at, file_id)
    select gen_random_uuid(), pm.new, c.label, c.is_sent, c.sent_at, null
    from checklist_items c join _pmap pm on pm.old = c.project_id;

    insert into project_docs (id, project_id, title, content_html, is_private, created_by, updated_by, updated_at)
    select gen_random_uuid(), pm.new, d.title, d.content_html, d.is_private, d.created_by, d.updated_by, d.updated_at
    from project_docs d join _pmap pm on pm.old = d.project_id;

    insert into project_folders (id, project_id, name, created_by, created_at)
    select gen_random_uuid(), pm.new, f.name, f.created_by, f.created_at
    from project_folders f join _pmap pm on pm.old = f.project_id;

    insert into messages (id, project_id, sender_id, content, is_read, created_at)
    select gen_random_uuid(), pm.new,
      case when ms.sender_id = p_source then p_demo else ms.sender_id end,
      ms.content, ms.is_read, ms.created_at
    from messages ms join _pmap pm on pm.old = ms.project_id;

    -- Referrals + credit ledger + redemptions (so the referral program + balance match).
    create temp table _rmap (old uuid primary key, new uuid not null default gen_random_uuid()) on commit drop;
    insert into _rmap(old) select id from referrals where referrer_id = p_source;

    insert into referrals (id, referrer_id, referred_name, referred_contact, note, status,
      deal_value, payment_method, payment_confirmed_at, payment_confirmed_by, created_at, updated_at)
    select m.new, p_demo, r.referred_name, r.referred_contact, r.note, r.status,
      r.deal_value, r.payment_method, r.payment_confirmed_at, r.payment_confirmed_by, r.created_at, r.updated_at
    from referrals r join _rmap m on m.old = r.id;

    insert into credit_transactions (id, client_id, amount, reason, referral_id, note, created_at, created_by)
    select gen_random_uuid(), p_demo, ct.amount, ct.reason, m.new, ct.note, ct.created_at, ct.created_by
    from credit_transactions ct left join _rmap m on m.old = ct.referral_id
    where ct.client_id = p_source;

    insert into reward_redemptions (id, client_id, reward_id, credits_spent, redeemed_at, status, fulfilled_at)
    select gen_random_uuid(), p_demo, rr.reward_id, rr.credits_spent, rr.redeemed_at, rr.status, rr.fulfilled_at
    from reward_redemptions rr where rr.client_id = p_source;
  end if;

  perform _demo_suspend_triggers(true);
end;
$$;

revoke all on function public.clone_into_demo(uuid, uuid) from public;
revoke all on function public.reset_demo_account(uuid) from public;
revoke all on function public.is_demo_account(uuid) from public;
grant execute on function public.clone_into_demo(uuid, uuid) to authenticated;
grant execute on function public.reset_demo_account(uuid) to authenticated;
grant execute on function public.is_demo_account(uuid) to authenticated;
