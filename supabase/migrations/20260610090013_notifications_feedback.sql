-- ============================================================
-- 0013 — Notifications + client feedback
-- Backfilled from live prod (this file was a stub; the DDL had only ever been
-- applied via the Supabase MCP). Reflects the CURRENT prod state, i.e. it already
-- includes the project_id/entity_id columns + enriched titles that migration
-- 0014 added on top, so the two files together reproduce prod exactly.
-- ============================================================

create table if not exists public.notifications (
  id           uuid not null default gen_random_uuid() primary key,
  audience     text not null check (audience in ('admin','client','partner')),
  recipient_id uuid references public.profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  link         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),
  project_id   uuid,
  entity_id    uuid
);
create index if not exists notifications_admin_idx     on public.notifications using btree (audience, is_read, created_at desc);
create index if not exists notifications_recipient_idx on public.notifications using btree (recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications
  for select to authenticated
  using (((audience = 'admin') and is_admin()) or (recipient_id = auth.uid()));
create policy notifications_admin_insert on public.notifications
  for insert to authenticated with check (is_admin());
create policy notifications_update on public.notifications
  for update to authenticated
  using (((audience = 'admin') and is_admin()) or (recipient_id = auth.uid()))
  with check (((audience = 'admin') and is_admin()) or (recipient_id = auth.uid()));

create table if not exists public.client_feedback (
  id         uuid not null default gen_random_uuid() primary key,
  client_id  uuid not null references public.profiles(id) on delete cascade,
  message    text not null,
  status     text not null default 'open' check (status in ('open','in_progress','resolved')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_feedback_idx on public.client_feedback using btree (created_at desc);

alter table public.client_feedback enable row level security;
create policy client_feedback_select on public.client_feedback
  for select to authenticated using ((client_id = auth.uid()) or is_admin());
create policy client_feedback_insert on public.client_feedback
  for insert to authenticated with check (client_id = auth.uid());
create policy client_feedback_admin_update on public.client_feedback
  for all to authenticated using (is_admin()) with check (is_admin());

-- Helper: insert an admin-facing notification.
create or replace function public.notify_admin(p_type text, p_title text, p_body text, p_link text, p_project_id uuid default null, p_entity_id uuid default null)
returns void language sql security definer set search_path to 'public' as $function$
  insert into public.notifications (audience, type, title, body, link, project_id, entity_id)
  values ('admin', p_type, p_title, p_body, p_link, p_project_id, p_entity_id);
$function$;

create or replace function public.notify_referral()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.notify_admin('referral', 'הפניה חדשה', new.referred_name, '/admin/referrals', null, new.id);
  return new;
end; $function$;

create or replace function public.notify_file()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_p text;
begin
  if not public.is_admin() then
    select title into v_p from public.projects where id = new.project_id;
    perform public.notify_admin('file', 'קובץ חדש · ' || coalesce(v_p,'פרויקט'),
      'הלקוח העלה: ' || new.file_name, '/projects/' || new.project_id, new.project_id, new.id);
  end if;
  return new;
end; $function$;

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_p text;
begin
  if not public.is_admin() then
    select title into v_p from public.projects where id = new.project_id;
    perform public.notify_admin('message', 'הודעה חדשה · ' || coalesce(v_p,'פרויקט'),
      left(new.content, 80), '/projects/' || new.project_id, new.project_id, new.id);
  end if;
  return new;
end; $function$;

create or replace function public.notify_approval()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_p text;
begin
  if not public.is_admin() and new.status is distinct from old.status then
    select title into v_p from public.projects where id = new.project_id;
    perform public.notify_admin('approval',
      (case when new.status = 'approved' then 'אישור עבודה · ' else 'הערות אישור · ' end) || coalesce(v_p,'פרויקט'),
      new.title, '/projects/' || new.project_id, new.project_id, new.id);
  end if;
  return new;
end; $function$;

create or replace function public.notify_checklist()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_p text;
begin
  if not public.is_admin() and new.is_sent and not old.is_sent then
    select title into v_p from public.projects where id = new.project_id;
    perform public.notify_admin('checklist', 'חומר נשלח · ' || coalesce(v_p,'פרויקט'),
      new.label, '/projects/' || new.project_id, new.project_id, new.id);
  end if;
  return new;
end; $function$;

create or replace function public.notify_feedback()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'INSERT' then
    perform public.notify_admin('feedback', 'הערה חדשה מלקוח', left(new.message, 80), '/admin/feedback');
  elsif tg_op = 'UPDATE' and (new.admin_reply is distinct from old.admin_reply or new.status is distinct from old.status) then
    insert into public.notifications (audience, recipient_id, type, title, body, link)
    values ('client', new.client_id, 'feedback_reply', 'עדכון על ההערה שלך',
            coalesce(left(new.admin_reply, 80), 'הסטטוס עודכן'), '/profile');
  end if;
  return new;
end; $function$;

create trigger referrals_notify        after insert on public.referrals        for each row execute function notify_referral();
create trigger files_notify            after insert on public.files            for each row execute function notify_file();
create trigger messages_notify         after insert on public.messages         for each row execute function notify_message();
create trigger approvals_notify        after update on public.approvals         for each row execute function notify_approval();
create trigger checklist_notify        after update on public.checklist_items   for each row execute function notify_checklist();
create trigger client_feedback_notify  after insert or update on public.client_feedback for each row execute function notify_feedback();
create trigger client_feedback_set_updated_at before update on public.client_feedback for each row execute function set_updated_at();
