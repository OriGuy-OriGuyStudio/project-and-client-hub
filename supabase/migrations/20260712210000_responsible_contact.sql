-- Task 12: Responsible-contact integrity
-- (a) trigger enforcing projects.client_id must be a member of projects.org_id
-- (b) remove_org_member reassigns contact-projects to a remaining member before deleting the membership

create or replace function public.check_project_contact()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.client_id is not null and new.org_id is not null
     and not exists (select 1 from public.organization_members m where m.org_id = new.org_id and m.user_id = new.client_id) then
    raise exception 'responsible contact must be a member of the project org';
  end if;
  return new;
end; $function$;

drop trigger if exists trg_check_project_contact on public.projects;
create trigger trg_check_project_contact before insert or update of client_id, org_id on public.projects
  for each row execute function public.check_project_contact();

create or replace function public.remove_org_member(p_member_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_org uuid; v_is_mgr boolean; v_removed_user uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select org_id, is_manager, user_id into v_org, v_is_mgr, v_removed_user from public.organization_members where id = p_member_id;
  if v_org is null then return; end if;
  if v_is_mgr and (select count(*) from public.organization_members where org_id = v_org and is_manager) <= 1 then
    raise exception 'cannot remove the last manager';
  end if;
  -- reassign this member's responsible-contact projects to the founding member AMONG THE REMAINING members
  update public.projects p set client_id = (
    select m2.user_id from public.organization_members m2
    where m2.org_id = v_org and m2.user_id <> v_removed_user
    order by m2.created_at, m2.user_id limit 1)
  where p.org_id = v_org and p.client_id = v_removed_user;
  delete from public.organization_members where id = p_member_id;
end; $function$;

notify pgrst, 'reload schema';
