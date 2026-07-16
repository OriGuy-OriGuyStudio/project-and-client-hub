-- ============================================================
-- Quote Plan 3 , sign_quote captures the signer's IP SERVER-SIDE from the
-- PostgREST request headers (x-forwarded-for, first hop) instead of trusting
-- a client-supplied value. p_ip stays in the signature for back-compat and as
-- a fallback. Carried item from the Plan 1 whole-plan review. Branch DB only.
-- ============================================================

create or replace function public.sign_quote(
  p_token uuid, p_name text, p_signature_image text,
  p_selected jsonb default '{}'::jsonb, p_ip text default null::text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_title text; v_ip text;
begin
  -- Server-side IP: first address in x-forwarded-for, if PostgREST provides it.
  v_ip := nullif(btrim(split_part(
            coalesce(current_setting('request.headers', true), '{}')::json->>'x-forwarded-for',
          ',', 1)), '');
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
