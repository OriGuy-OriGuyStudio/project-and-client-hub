-- ============================================================
-- 0002 — Core domain tables (brand, projects, and per-project content)
-- ============================================================

-- ---- Client brand identity ---------------------------------
create table public.client_brand (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null unique references public.profiles on delete cascade,
  business_name        text,
  business_description text,
  logo_url             text,
  logo_icon_url        text,
  font_notes           text,
  website_url          text,
  social_links         jsonb not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);

create table public.brand_colors (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles on delete cascade,
  hex_value  text not null,
  label      text,
  role       text check (role in ('primary','secondary','accent','background','text','other')),
  sort_order int not null default 0
);
create index brand_colors_client_idx on public.brand_colors (client_id, sort_order);

-- ---- Projects ----------------------------------------------
create table public.projects (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  client_id           uuid not null references public.profiles on delete cascade,
  status              text not null default 'active' check (status in ('active','on_hold','completed','cancelled')),
  figma_url           text,
  staging_url         text,
  live_url            text,
  warranty_start_date date,
  -- date + integer => date, so the 30-day window stays a clean date
  warranty_end_date   date generated always as (warranty_start_date + 30) stored,
  warranty_email_sent boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index projects_client_idx on public.projects (client_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---- Roadmap stages ----------------------------------------
create table public.project_stages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  title       text not null,
  assignee    text check (assignee in ('admin','client')),
  due_date    date,
  status      text not null default 'not_started' check (status in ('not_started','in_progress','done','blocked')),
  order_index int not null default 0
);
create index project_stages_project_idx on public.project_stages (project_id, order_index);

-- ---- Approvals ---------------------------------------------
create table public.approvals (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'pending' check (status in ('pending','approved','needs_changes')),
  client_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index approvals_project_idx on public.approvals (project_id);

create trigger approvals_set_updated_at
  before update on public.approvals
  for each row execute function public.set_updated_at();

-- ---- Files (metadata; bytes live in Storage) ---------------
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects on delete cascade,
  folder_path  text not null default '/',
  file_name    text not null,
  storage_path text not null,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid references public.profiles on delete set null,
  is_private   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index files_project_idx on public.files (project_id, folder_path);

-- ---- Onboarding checklist ----------------------------------
create table public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  label      text not null,
  is_sent    boolean not null default false,
  sent_at    timestamptz,
  file_id    uuid references public.files on delete set null
);
create index checklist_project_idx on public.checklist_items (project_id);

-- ---- Tasks -------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  title       text not null,
  description text,
  assignee_id uuid references public.profiles on delete set null,
  due_date    date,
  status      text not null default 'open' check (status in ('open','in_progress','done')),
  is_private  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id);

-- ---- Project documents (rich text) -------------------------
create table public.project_docs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects on delete cascade,
  title        text not null,
  content_html text,
  is_private   boolean not null default false,
  created_by   uuid references public.profiles on delete set null,
  updated_by   uuid references public.profiles on delete set null,
  updated_at   timestamptz not null default now()
);
create index project_docs_project_idx on public.project_docs (project_id);

create trigger project_docs_set_updated_at
  before update on public.project_docs
  for each row execute function public.set_updated_at();

-- ---- Payments ----------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects on delete cascade,
  label           text not null,
  amount          numeric(10,2),
  currency        text not null default 'ILS',
  due_date        date,
  status          text not null default 'pending' check (status in ('pending','paid')),
  payment_link    text,
  invoice_file_id uuid references public.files on delete set null,
  paid_at         timestamptz
);
create index payments_project_idx on public.payments (project_id);

-- ---- Internal messages -------------------------------------
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  sender_id  uuid not null references public.profiles on delete cascade,
  content    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_project_idx on public.messages (project_id, created_at);

-- ---- Activity log (immutable feed) -------------------------
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  actor_id    uuid references public.profiles on delete set null,
  action_type text not null,
  description text not null,
  created_at  timestamptz not null default now()
);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);

-- ---- Admin-only private notes per client -------------------
create table public.admin_client_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null unique references public.profiles on delete cascade,
  content    text,
  updated_at timestamptz not null default now()
);

create trigger admin_client_notes_set_updated_at
  before update on public.admin_client_notes
  for each row execute function public.set_updated_at();
