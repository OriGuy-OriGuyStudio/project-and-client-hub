-- ============================================================
-- 0016 — Studio settings (singleton) + editable stage templates
-- ============================================================
-- Backs the admin Settings page: studio profile/branding, the warranty-email
-- template, and the roadmap stage templates (previously hard-coded in the app).

-- ---- Singleton settings row -------------------------------------------------
create table public.studio_settings (
  id                      boolean primary key default true check (id),
  studio_name             text not null default 'Studio Ori Guy',
  tagline                 text,
  contact_email           text,
  contact_phone           text,
  warranty_email_subject  text default 'האחריות על האתר שלך מתקרבת לסיום',
  warranty_email_body     text,
  updated_at              timestamptz not null default now()
);

alter table public.studio_settings enable row level security;

-- Readable by any signed-in user (branding shows to clients); admin writes.
create policy "studio_settings_read" on public.studio_settings
  for select to authenticated using (true);
create policy "studio_settings_admin_write" on public.studio_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.studio_settings (id, tagline, warranty_email_body)
values (
  true,
  'פורטל לקוחות',
  E'היי,\nתקופת האחריות על האתר שלך מתקרבת לסיום.\nאם תרצה להאריך אותה או לקבל הצעה לתחזוקה שוטפת, אשמח לדבר.\n\nאורי'
)
on conflict (id) do nothing;

-- ---- Editable roadmap stage templates --------------------------------------
create table public.stage_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  stages      jsonb not null default '[]'::jsonb,  -- [{ "title": text, "assignee": "admin"|"client" }]
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.stage_templates enable row level security;

-- Admin-only (templates are an internal authoring tool).
create policy "stage_templates_admin_all" on public.stage_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.stage_templates (name, order_index, stages) values
('אתר תדמית', 0, '[
  {"title":"אפיון ואיסוף חומרים","assignee":"client"},
  {"title":"עיצוב UI/UX","assignee":"admin"},
  {"title":"אישור עיצוב","assignee":"client"},
  {"title":"פיתוח","assignee":"admin"},
  {"title":"הזנת תוכן","assignee":"client"},
  {"title":"בדיקות והגהה","assignee":"admin"},
  {"title":"עלייה לאוויר","assignee":"admin"},
  {"title":"תקופת אחריות","assignee":"admin"}
]'::jsonb),
('חנות אונליין', 1, '[
  {"title":"אפיון ואיסוף חומרים","assignee":"client"},
  {"title":"עיצוב UI/UX","assignee":"admin"},
  {"title":"אישור עיצוב","assignee":"client"},
  {"title":"פיתוח החנות","assignee":"admin"},
  {"title":"הקמת קטלוג ומוצרים","assignee":"client"},
  {"title":"הגדרת תשלום ומשלוחים","assignee":"admin"},
  {"title":"בדיקות והגהה","assignee":"admin"},
  {"title":"עלייה לאוויר","assignee":"admin"},
  {"title":"תקופת אחריות","assignee":"admin"}
]'::jsonb),
('דף נחיתה', 2, '[
  {"title":"אפיון ומסרים שיווקיים","assignee":"client"},
  {"title":"עיצוב הדף","assignee":"admin"},
  {"title":"אישור עיצוב","assignee":"client"},
  {"title":"פיתוח","assignee":"admin"},
  {"title":"חיבור טפסים ופיקסלים","assignee":"admin"},
  {"title":"בדיקות","assignee":"admin"},
  {"title":"עלייה לאוויר","assignee":"admin"}
]'::jsonb),
('אפליקציה אינטרנטית', 3, '[
  {"title":"אפיון ובניית דרישות","assignee":"client"},
  {"title":"עיצוב UI/UX ו-Wireframes","assignee":"admin"},
  {"title":"אישור עיצוב","assignee":"client"},
  {"title":"הקמת תשתית ובסיס נתונים","assignee":"admin"},
  {"title":"פיתוח Backend / API","assignee":"admin"},
  {"title":"פיתוח Frontend","assignee":"admin"},
  {"title":"אינטגרציות","assignee":"admin"},
  {"title":"בדיקות QA","assignee":"admin"},
  {"title":"עלייה לאוויר","assignee":"admin"},
  {"title":"תחזוקה ואחריות","assignee":"admin"}
]'::jsonb),
('חידוש אתר קיים (Redesign)', 4, '[
  {"title":"אבחון האתר הקיים","assignee":"admin"},
  {"title":"אפיון שיפורים נדרשים","assignee":"client"},
  {"title":"עיצוב מחדש","assignee":"admin"},
  {"title":"אישור עיצוב","assignee":"client"},
  {"title":"פיתוח והעברת תוכן","assignee":"admin"},
  {"title":"בדיקות","assignee":"admin"},
  {"title":"עלייה לאוויר","assignee":"admin"},
  {"title":"תקופת אחריות","assignee":"admin"}
]'::jsonb);
