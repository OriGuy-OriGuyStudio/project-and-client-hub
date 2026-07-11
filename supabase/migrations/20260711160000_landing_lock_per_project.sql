-- ============================================================
-- 0103 — landing lock is PER PROJECT, not per client
-- ============================================================
-- A client can have several projects. The invite link carries the project it's
-- for, so the sign-form lock must be scoped to THAT project:
--   * has_package  — the project already has an active package  → "חבילה פעילה"
--   * has_request  — a request was already submitted for it, no package yet
--                    → "בקשה פעילה"
--   * neither      → show the form (even if the client has other projects)
-- Replaces the previous client-wide `already_active` flag.
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
    'has_package', li.project_id is not null and exists (
      select 1 from public.project_service ps
      where ps.project_id = li.project_id and ps.active
    ),
    'has_request', exists (
      select 1 from public.service_agreements sa
      where (li.project_id is not null and sa.project_id = li.project_id)
         or sa.invite_token = li.token
    )
  )
  from public.landing_invites li
  left join public.profiles p on p.id = li.client_id
  left join public.client_brand cb on cb.client_id = li.client_id
  left join public.projects pr on pr.id = li.project_id
  where li.token = p_token;
$$;

notify pgrst, 'reload schema';
