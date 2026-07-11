alter table public.organizations add column if not exists kind text not null default 'real'
  check (kind in ('real','demo','studio'));

-- backfill from the founding member's email using the same lists the app uses.
-- STUDIO emails and DEMO emails are enumerated here to match src/lib/demo.ts +
-- the internal-client list; keep them in sync.
with founder as (
  select distinct on (m.org_id) m.org_id, lower(pr.email) as email
  from public.organization_members m join public.profiles pr on pr.id = m.user_id
  order by m.org_id, m.created_at, m.user_id
)
update public.organizations o set kind = case
  when f.email like '%@origuystudio.com' then 'studio'
  when f.email in ('origudev@gmail.com','origuydev@gmail.com','origuy2018@gmail.com','dana@example.com','galil@example.com','sample-client@example.com') then 'demo'
  else 'real' end
from founder f where f.org_id = o.id;

notify pgrst, 'reload schema';
