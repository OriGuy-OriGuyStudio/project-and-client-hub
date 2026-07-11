-- ============================================================
-- 0104 — reject/dismiss a service agreement request
-- ============================================================
-- Ori can reject a signed request (e.g. a test or a duplicate). It sets the
-- agreement status to 'cancelled', which (a) removes it from the "ממתין לטיפול"
-- panel and (b) unlocks the landing form for that project (has_request only
-- counts 'submitted' requests).
-- ============================================================

create or replace function public.dismiss_service_agreement(p_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.service_agreements
     set status = 'cancelled', updated_at = now()
   where id = p_id and status = 'submitted';
  return json_build_object('ok', true);
end $$;
grant execute on function public.dismiss_service_agreement(uuid) to authenticated;

-- Landing lock: only an OPEN ('submitted') request counts as a pending request.
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
    'has_package', li.project_id is not null and exists (
      select 1 from public.project_service ps
      where ps.project_id = li.project_id and ps.active
    ),
    'has_request', exists (
      select 1 from public.service_agreements sa
      where sa.status = 'submitted'
        and ((li.project_id is not null and sa.project_id = li.project_id)
             or sa.invite_token = li.token)
    )
  )
  from public.landing_invites li
  left join public.profiles p on p.id = li.client_id
  left join public.client_brand cb on cb.client_id = li.client_id
  left join public.projects pr on pr.id = li.project_id
  where li.token = p_token;
$$;

notify pgrst, 'reload schema';
