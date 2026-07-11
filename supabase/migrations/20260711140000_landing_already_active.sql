-- ============================================================
-- 0102 — landing: flag when the client already signed / is active
-- ============================================================
-- Prevents a client from signing the same package again and again. The landing
-- reads `already_active` and, when true, shows an "active request/package" state
-- instead of the sign form. True when the client already has an active package,
-- or an agreement already exists for this invite.
-- ============================================================

create or replace function public.get_landing_context(p_token text)
returns json
language sql security definer stable set search_path = public as $$
  select json_build_object(
    'token', li.token,
    'client_id', li.client_id,
    'project_id', li.project_id,
    'project_title', pr.title,
    'name', coalesce(li.lead_name, p.full_name),
    'business', coalesce(li.business, cb.business_name),
    'email', coalesce(li.email, p.email),
    'phone', coalesce(li.phone, p.phone),
    'tier', li.tier,
    'site_type', li.site_type,
    'gender', li.gender,
    'already_active',
      exists (
        select 1 from public.project_service ps
        join public.projects prj on prj.id = ps.project_id
        where prj.client_id = li.client_id and ps.active
      )
      or exists (
        select 1 from public.service_agreements sa where sa.invite_token = li.token
      )
  )
  from public.landing_invites li
  left join public.profiles p on p.id = li.client_id
  left join public.client_brand cb on cb.client_id = li.client_id
  left join public.projects pr on pr.id = li.project_id
  where li.token = p_token;
$$;

notify pgrst, 'reload schema';
