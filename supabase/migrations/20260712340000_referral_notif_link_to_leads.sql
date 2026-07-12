-- Referrals are now managed on the consolidated "כל הלידים" page (/admin/leads);
-- /admin/referrals became the rewards-store page. Point new-referral admin
-- notifications (and fix existing ones) at /admin/leads so the bell link lands
-- where referrals are actually handled.
create or replace function public.notify_referral()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.notify_admin('referral', 'הפניה חדשה', new.referred_name, '/admin/leads', null, new.id);
  return new;
end; $function$;

update public.notifications
   set link = '/admin/leads'
 where type = 'referral'
   and link = '/admin/referrals';
