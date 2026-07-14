-- ============================================================
-- Price-quote system (Phase A): an admin pricing calculator that produces a
-- client-facing quote page with upsells, optional maintenance, and a signature.
--   * price_quotes  — one quote (content jsonb + share token + signature).
--   * quote_catalog — reusable "ready-made" pages/features/upsells the admin edits.
-- Client page is token-based (prospects aren't logged in): two SECURITY DEFINER
-- RPCs (get_quote_public / sign_quote) gate all anon access.
-- ============================================================

create table if not exists public.price_quotes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations on delete set null,
  project_id    uuid references public.projects on delete set null,
  title         text not null default 'הצעת מחיר',
  client_name   text,
  site_type     text not null default 'portfolio'
                  check (site_type in ('landing','portfolio','store','app','custom')),
  content       jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft','sent','signed','declined')),
  share_token   uuid not null unique default gen_random_uuid(),
  selected      jsonb not null default '{}'::jsonb,   -- {upsell_ids:[], maintenance_tier:null}
  signed_name   text,
  signature_image text,
  signed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists price_quotes_org_idx on public.price_quotes (org_id);
create index if not exists price_quotes_token_idx on public.price_quotes (share_token);

create table if not exists public.quote_catalog (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('page','feature','upsell')),
  site_type    text check (site_type in ('landing','portfolio','store','app','custom')), -- null = all
  label        text not null,
  description  text,
  base_price   numeric,
  default_mult numeric not null default 1,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists quote_catalog_kind_idx on public.quote_catalog (kind, site_type, sort);

alter table public.price_quotes enable row level security;
alter table public.quote_catalog enable row level security;

-- Admin-only direct access to both tables. The client never reads price_quotes
-- directly — only through the token RPCs below.
create policy "price_quotes_admin" on public.price_quotes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "quote_catalog_admin" on public.quote_catalog
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public read of a single quote by share token (drops internal notes).
create or replace function public.get_quote_public(p_token uuid)
returns jsonb language sql security definer set search_path to 'public' stable as $function$
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'client_name', q.client_name,
    'site_type', q.site_type,
    'status', q.status,
    'content', q.content - 'notes',
    'selected', q.selected,
    'signed_name', q.signed_name,
    'signed_at', q.signed_at,
    'created_at', q.created_at,
    'org_name', o.name
  )
  from public.price_quotes q
  left join public.organizations o on o.id = q.org_id
  where q.share_token = p_token
  limit 1;
$function$;

grant execute on function public.get_quote_public(uuid) to anon, authenticated;

-- Client signs the quote: records their selections + signature, flips to 'signed'.
-- Only from draft/sent; a signed quote is locked.
create or replace function public.sign_quote(
  p_token uuid,
  p_name text,
  p_signature_image text,
  p_upsell_ids jsonb default '[]'::jsonb,
  p_maintenance_tier text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_title text;
begin
  update public.price_quotes
     set status = 'signed',
         signed_name = nullif(left(coalesce(p_name, ''), 120), ''),
         signature_image = nullif(p_signature_image, ''),
         signed_at = now(),
         selected = jsonb_build_object(
           'upsell_ids', coalesce(p_upsell_ids, '[]'::jsonb),
           'maintenance_tier', p_maintenance_tier
         ),
         updated_at = now()
   where share_token = p_token
     and status in ('draft','sent')
   returning id, title into v_id, v_title;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'quote not found or already signed');
  end if;

  perform public.notify_admin('quote', 'הצעת מחיר נחתמה · ' || coalesce(v_title, 'הצעה'),
    coalesce(p_name, 'הלקוח') || ' אישר את ההצעה', '/admin/tools/quote', null, v_id);

  return jsonb_build_object('ok', true);
end; $function$;

grant execute on function public.sign_quote(uuid, text, text, jsonb, text) to anon, authenticated;

-- ---- seed the ready-made catalog ----------------------------------------
insert into public.quote_catalog (kind, site_type, label, base_price, default_mult, sort) values
  -- pages (portfolio / תדמית defaults, from Ori's calculator)
  ('page','portfolio','בית',            850, 1,   10),
  ('page','portfolio','אודות',          850, 1,   20),
  ('page','portfolio','שירותים',        850, 1,   30),
  ('page','portfolio','פורטפוליו',      850, 1.5, 40),
  ('page','portfolio','בלוג',           850, 1.5, 50),
  ('page','portfolio','צור קשר',        850, 1,   60),
  ('page','portfolio','עמוד שירות בודד', 850, 1,   70),
  ('page','portfolio','עמוד פרויקט בודד',850, 1.5, 80),
  -- pages (store)
  ('page','store','דף בית',             850, 1.5, 10),
  ('page','store','דף קטגוריה',         850, 1,   20),
  ('page','store','דף מוצר',            850, 2,   30),
  ('page','store','סל קניות',           850, 1.5, 40),
  ('page','store','תשלום (Checkout)',   850, 2,   50),
  ('page','store','אודות',              850, 1,   60),
  ('page','store','צור קשר',            850, 1,   70),
  -- pages (landing)
  ('page','landing','דף נחיתה',         850, 1.5, 10),
  ('page','landing','עמוד תודה',        850, 1,   20),
  -- features (universal)
  ('feature',null,'מערכת ניהול תוכן',   975, 1.5, 10),
  ('feature',null,'טפסים מתקדמים',      650, 1,   20),
  ('feature',null,'נגישות מלאה',        650, 1,   30),
  ('feature',null,'רב-לשוני',           650, 1.5, 40),
  ('feature',null,'אזור אישי / התחברות',650, 2,   50),
  ('feature',null,'אינטגרציית תשלום',   650, 1.5, 60),
  ('feature',null,'אנימציות מתקדמות',   650, 1.5, 70),
  ('feature',null,'SEO טכני מוטמע',     650, 1,   80),
  ('feature',null,'אינטגרציית CRM/וואטסאפ',650, 1.5, 90),
  -- upsells (universal, the money-makers)
  ('upsell',null,'כתיבת תוכן מקצועית',      1200, 1, 10),
  ('upsell',null,'חבילת SEO התחלתית',       1500, 1, 20),
  ('upsell',null,'עיצוב לוגו ומיתוג',       1800, 1, 30),
  ('upsell',null,'צילום עסק / מוצר',        1500, 1, 40),
  ('upsell',null,'הקמת דיוור (ניוזלטר)',     900, 1, 50),
  ('upsell',null,'קמפיין השקה (Google/Meta)',2500, 1, 60),
  ('upsell',null,'דומיין + אחסון לשנה',      600, 1, 70)
on conflict do nothing;
