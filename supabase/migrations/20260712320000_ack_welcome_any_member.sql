-- ack_service_welcome gated on projects.client_id = auth.uid() (the single
-- responsible contact), so a non-contact org member opening "השירות שלך" could
-- not dismiss the one-time welcome popup (the update silently no-op'd, banner
-- kept reappearing). Swap to can_access_project so any org member with access
-- can acknowledge it, matching the service_calls / files access model.
create or replace function public.ack_service_welcome(p_project uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.project_service ps
     set welcome_seen_at = now()
   where ps.project_id = p_project
     and ps.welcome_seen_at is null
     and public.can_access_project(p_project);
  return json_build_object('ok', true);
end $function$;

notify pgrst, 'reload schema';
