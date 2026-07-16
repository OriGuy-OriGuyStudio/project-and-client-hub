-- ============================================================
-- Quote Plan 3 final-review fixes , sign_quote hardening:
-- 1) EXPIRY enforced server-side: a `sent` quote past its validity window can
--    no longer be signed via a direct RPC call (the page already blocks it,
--    but a legally binding record must be guarded at the DB). Drafts never
--    expire (admin previews).
-- 2) signed_ip anti-spoof: take the LAST x-forwarded-for element (the hop the
--    gateway itself appended) instead of the first, which a caller can forge
--    by sending their own X-Forwarded-For header.
-- Branch DB (dbchappsqcsixxecxzqv) only.
-- ============================================================

create or replace function public.sign_quote(
  p_token uuid, p_name text, p_signature_image text,
  p_selected jsonb default '{}'::jsonb, p_ip text default null::text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_title text; v_ip text; v_xff text[]; v_expired boolean;
begin
  -- Server-side IP: last x-forwarded-for element = appended by the gateway,
  -- not forgeable by the caller (a forged header ends up leftmost).
  v_xff := string_to_array(coalesce(current_setting('request.headers', true), '{}')::json->>'x-forwarded-for', ',');
  if v_xff is not null and array_length(v_xff, 1) > 0 then
    v_ip := nullif(btrim(v_xff[array_length(v_xff, 1)]), '');
  end if;

  -- Server-side expiry guard (sent quotes only; drafts are admin previews).
  select (q.status = 'sent'
          and coalesce((q.content->>'validity_days')::int, 0) > 0
          and now() > coalesce(q.sent_at, q.created_at)
                      + make_interval(days => (q.content->>'validity_days')::int))
    into v_expired
  from public.price_quotes q where q.share_token = p_token;
  if v_expired then return jsonb_build_object('ok', false, 'error', 'expired'); end if;

  update public.price_quotes
     set status='signed', signed_name=nullif(left(coalesce(p_name,''),120),''),
         signature_image=nullif(p_signature_image,''), signed_at=now(),
         signed_ip=coalesce(v_ip, nullif(p_ip,'')), selected=coalesce(p_selected,'{}'::jsonb), updated_at=now()
   where share_token=p_token and status in ('draft','sent')
   returning id, title into v_id, v_title;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'quote not found or already signed'); end if;
  perform public.notify_admin('quote', 'הצעת מחיר נחתמה · ' || coalesce(v_title,'הצעה'),
    coalesce(p_name,'הלקוח') || ' אישר את ההצעה', '/admin/tools/quote', null, v_id);
  return jsonb_build_object('ok', true);
end; $function$;
