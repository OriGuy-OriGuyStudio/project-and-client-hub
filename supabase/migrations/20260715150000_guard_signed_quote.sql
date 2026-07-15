-- ============================================================
-- Quote system v2 , immutability guard. Once a quote is signed it is a binding
-- record: block direct edits to its protected fields (content snapshot, price,
-- selection, identity, status, signature) at the DB level, not just in the UI.
-- Follows the project's guard_* trigger pattern. See spec §13.2.
-- ============================================================

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
  ) then
    raise exception 'signed quote is immutable';
  end if;
  return NEW;
end; $function$;

drop trigger if exists guard_signed_quote on public.price_quotes;
create trigger guard_signed_quote before update on public.price_quotes
  for each row execute function public.guard_signed_quote();
