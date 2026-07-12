-- Per-package notification email: the email a client typed on the service
-- landing page (service_agreements.email) is meant for THAT package's
-- notifications (monthly reports, package confirmation, service-call
-- updates), not necessarily the account owner's login email. Today
-- project_service has no email column, so those mails fell back to
-- profiles.email. Add notify_email and backfill it from the client's latest
-- submitted agreement for the same project.
alter table public.project_service add column if not exists notify_email text;

update public.project_service ps
set notify_email = a.email
from (
  select distinct on (project_id) project_id, email
  from public.service_agreements
  where email is not null and project_id is not null and status = 'submitted'
  order by project_id, created_at desc
) a
where a.project_id = ps.project_id
  and ps.notify_email is null;

notify pgrst, 'reload schema';
