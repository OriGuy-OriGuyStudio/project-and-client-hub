-- ============================================================
-- Quote system v2 , token RPCs (public read + sign with IP + mark viewed).
-- get_quote_public returns the v2 top-level fields; mark_quote_viewed stamps
-- viewed_at once; sign_quote records the signature, selection snapshot, and IP.
-- See spec 2026-07-15-quote-system-v2-design.md (§13).
--
-- NOTE: sign_quote renames its input params (p_selected / p_ip). Postgres
-- forbids renaming params via CREATE OR REPLACE, so the old signature is
-- dropped first. This retires the v1 sign path (old client page) on the dev
-- branch; the v2 client page (Plan 3) will call the new signature.
-- ============================================================

create or replace function public.get_quote_public(p_token uuid)
returns jsonb language sql security definer set search_path to 'public' stable as $function$
  select jsonb_build_object(
    'id', q.id, 'title', q.title, 'client_name', q.client_name, 'client_business', q.client_business,
    'type', q.type, 'subtype', q.subtype, 'status', q.status,
    'final_price', q.final_price, 'content', q.content - 'notes', 'selected', q.selected,
    'signed_name', q.signed_name, 'signed_at', q.signed_at, 'created_at', q.created_at,
    'sent_at', q.sent_at, 'viewed_at', q.viewed_at, 'org_name', o.name
  )
  from public.price_quotes q left join public.organizations o on o.id = q.org_id
  where q.share_token = p_token limit 1;
$function$;
grant execute on function public.get_quote_public(uuid) to anon, authenticated;

create or replace function public.mark_quote_viewed(p_token uuid)
returns void language sql security definer set search_path to 'public' as $function$
  update public.price_quotes set viewed_at = now()
  where share_token = p_token and viewed_at is null and status in ('sent','draft');
$function$;
grant execute on function public.mark_quote_viewed(uuid) to anon, authenticated;

drop function if exists public.sign_quote(uuid, text, text, jsonb, text);
create function public.sign_quote(
  p_token uuid, p_name text, p_signature_image text,
  p_selected jsonb default '{}'::jsonb, p_ip text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_title text;
begin
  update public.price_quotes
     set status='signed', signed_name=nullif(left(coalesce(p_name,''),120),''),
         signature_image=nullif(p_signature_image,''), signed_at=now(),
         signed_ip=nullif(p_ip,''), selected=coalesce(p_selected,'{}'::jsonb), updated_at=now()
   where share_token=p_token and status in ('draft','sent')
   returning id, title into v_id, v_title;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'quote not found or already signed'); end if;
  perform public.notify_admin('quote', 'הצעת מחיר נחתמה · ' || coalesce(v_title,'הצעה'),
    coalesce(p_name,'הלקוח') || ' אישר את ההצעה', '/admin/tools/quote', null, v_id);
  return jsonb_build_object('ok', true);
end; $function$;
grant execute on function public.sign_quote(uuid, text, text, jsonb, text) to anon, authenticated;
