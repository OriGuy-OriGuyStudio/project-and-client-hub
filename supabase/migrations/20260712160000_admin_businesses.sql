-- Admin "Businesses" list — one aggregated row per organization (members,
-- projects, last activity), avoiding N+1 queries / PostgREST relationship
-- friction on the admin Businesses page (org-centric admin, task 3).
create or replace function public.admin_businesses()
returns table(id uuid, name text, kind text, members integer, projects integer, last_activity timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select o.id, o.name, o.kind,
    (select count(*)::int from public.organization_members m where m.org_id = o.id),
    (select count(*)::int from public.projects p where p.org_id = o.id),
    greatest(
      (select max(pr.last_seen_at) from public.organization_members m join public.profiles pr on pr.id=m.user_id where m.org_id=o.id),
      (select max(p.updated_at) from public.projects p where p.org_id=o.id)
    )
  from public.organizations o
  order by o.kind, o.name;
end; $function$;
grant execute on function public.admin_businesses() to authenticated;
notify pgrst, 'reload schema';
