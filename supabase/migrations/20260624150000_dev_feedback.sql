-- ============================================================
-- 0078 — Client dev-feedback board (comments on the built site)
-- ============================================================
-- A native in-portal way for the client to leave precise comments on the
-- developed site (page + note + screenshot + priority). The admin promotes a
-- comment into the task board with one click: it finds the project's existing
-- "revision round" group (or creates one named after the project) and adds the
-- task there; the task's done-status syncs back so the client sees "טופל".
-- ============================================================

create table if not exists public.dev_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  page text,
  body text not null,
  screenshot_path text,
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  status text not null default 'received' check (status in ('received','in_progress','done')),
  task_id uuid references public.admin_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dev_feedback_project_idx on public.dev_feedback(project_id);

alter table public.dev_feedback enable row level security;

-- Client sees/adds on their own project; admin sees/manages everything.
create policy dev_feedback_select on public.dev_feedback for select to authenticated
  using (public.is_admin() or public.owns_project(project_id));
create policy dev_feedback_insert on public.dev_feedback for insert to authenticated
  with check ((public.is_admin() or public.owns_project(project_id)) and author_id = auth.uid());
create policy dev_feedback_delete on public.dev_feedback for delete to authenticated
  using (public.is_admin() or (public.owns_project(project_id) and author_id = auth.uid() and status = 'received'));
-- Only the admin changes status / links a task.
create policy dev_feedback_update on public.dev_feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Promote a comment into the task board ----------
create or replace function public.promote_dev_feedback(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fb dev_feedback;
  v_client uuid;
  v_name text;
  v_group uuid;
  v_task uuid;
  v_urgency text;
  v_title text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into v_fb from dev_feedback where id = p_id;
  if v_fb.id is null then raise exception 'not_found'; end if;

  select client_id into v_client from projects where id = v_fb.project_id;
  v_name := coalesce(
    (select business_name from client_brand where client_id = v_client),
    (select title from projects where id = v_fb.project_id),
    'סבב תיקונים'
  );

  -- Find this project's existing group, else create one named after the project.
  select id into v_group from admin_task_groups
    where project_id = v_fb.project_id order by created_at limit 1;
  if v_group is null then
    insert into admin_task_groups (title, project_id, order_index)
    values (v_name, v_fb.project_id, (select coalesce(max(order_index), -1) + 1 from admin_task_groups))
    returning id into v_group;
  end if;

  v_urgency := case when v_fb.priority = 'urgent' then 'high' else 'medium' end;
  v_title := left(
    case when coalesce(v_fb.page, '') <> '' then '[' || v_fb.page || '] ' else '' end || v_fb.body,
    140);

  insert into admin_tasks (title, urgency, status, project_id, client_id, group_id, note)
  values (v_title, v_urgency, 'todo', v_fb.project_id, v_client, v_group,
    case when coalesce(v_fb.page, '') <> '' then 'עמוד: ' || v_fb.page || E'\n' else '' end || v_fb.body)
  returning id into v_task;

  update dev_feedback set status = 'in_progress', task_id = v_task, updated_at = now() where id = p_id;
  return v_task;
end;
$$;

revoke all on function public.promote_dev_feedback(uuid) from public;
grant execute on function public.promote_dev_feedback(uuid) to authenticated;

-- ---------- Keep the client-visible status in sync with the task ----------
create or replace function public.sync_dev_feedback_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'done' and old.status <> 'done' then
      update dev_feedback set status = 'done', updated_at = now() where task_id = new.id;
    elsif new.status <> 'done' and old.status = 'done' then
      update dev_feedback set status = 'in_progress', updated_at = now() where task_id = new.id;
    end if;
  elsif tg_op = 'DELETE' then
    -- Task removed → the comment returns to the queue (FK already nulled task_id).
    update dev_feedback set status = 'received', updated_at = now() where task_id = old.id;
  end if;
  return null;
end;
$$;

drop trigger if exists dev_feedback_task_status on public.admin_tasks;
create trigger dev_feedback_task_status
  after update of status on public.admin_tasks
  for each row execute function public.sync_dev_feedback_status();

drop trigger if exists dev_feedback_task_deleted on public.admin_tasks;
create trigger dev_feedback_task_deleted
  before delete on public.admin_tasks
  for each row execute function public.sync_dev_feedback_status();

-- ---------- Notify the admin on a new client comment ----------
create or replace function public.notify_dev_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    perform notify_admin('dev_feedback', 'הערת פיתוח חדשה מלקוח',
      left(new.body, 160), '/projects/' || new.project_id::text, new.project_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists dev_feedback_notify on public.dev_feedback;
create trigger dev_feedback_notify
  after insert on public.dev_feedback
  for each row execute function public.notify_dev_feedback();

notify pgrst, 'reload schema';
