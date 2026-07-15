-- ============================================================
-- Quote system v2 , extend the signed-quote guard: block deletes of signed
-- quotes at the DB level (a signed quote is a binding record), and protect
-- `anchor_value` on the existing update guard too. Follows the project's
-- guard_* trigger pattern. See spec §13.2 and 20260715150000_guard_signed_quote.sql.
-- ============================================================

-- Re-state the update guard verbatim, adding anchor_value to the protected set.
create or replace function public.guard_signed_quote()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if OLD.status = 'signed' and (
       NEW.content         is distinct from OLD.content
    or NEW.final_price     is distinct from OLD.final_price
    or NEW.selected        is distinct from OLD.selected
    or NEW.type            is distinct from OLD.type
    or NEW.subtype         is distinct from OLD.subtype
    or NEW.title           is distinct from OLD.title
    or NEW.status          is distinct from OLD.status
    or NEW.signed_name     is distinct from OLD.signed_name
    or NEW.signature_image is distinct from OLD.signature_image
    or NEW.anchor_value    is distinct from OLD.anchor_value
  ) then
    raise exception 'signed quote is immutable';
  end if;
  return NEW;
end; $function$;

drop trigger if exists guard_signed_quote on public.price_quotes;
create trigger guard_signed_quote before update on public.price_quotes
  for each row execute function public.guard_signed_quote();

-- New: block deletes of signed quotes outright.
create or replace function public.guard_delete_signed_quote()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if OLD.status = 'signed' then
    raise exception 'signed quote cannot be deleted';
  end if;
  return OLD;
end; $function$;

drop trigger if exists guard_delete_signed_quote on public.price_quotes;
create trigger guard_delete_signed_quote before delete on public.price_quotes
  for each row execute function public.guard_delete_signed_quote();
