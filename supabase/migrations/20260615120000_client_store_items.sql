-- ============================================================
-- 0029 — Add shared rewards to the CLIENT store
-- Several partner-store items are relevant to clients too. Seed
-- client-audience copies (costs in client credits, editable later).
-- ============================================================

do $$
begin
  if not exists (select 1 from public.rewards where audience='client' and name='שובר מתנה ₪100') then
    insert into public.rewards (name, description, credit_cost, reward_type, is_active, audience, kind)
    values ('שובר מתנה ₪100', 'שובר מתנה לרשת לבחירתך.', 80, 'custom', true, 'client', 'generic');
  end if;

  if not exists (select 1 from public.rewards where audience='client' and name='פוסט שיתופי + קישור לאתר שלך') then
    insert into public.rewards (name, description, credit_cost, reward_type, is_active, audience, kind)
    values ('פוסט שיתופי + קישור לאתר שלך', 'פוסט/סטורי משותף בערוצים של הסטודיו וקישור (dofollow) לאתר שלך. חשיפה ו-SEO.', 60, 'custom', true, 'client', 'generic');
  end if;

  if not exists (select 1 from public.rewards where audience='client' and name='גישה לפיקסל (ה-AI)') then
    insert into public.rewards (name, description, credit_cost, reward_type, is_active, audience, kind)
    values ('גישה לפיקסל (ה-AI)', 'גישה ל-Pixel, עוזר ה-AI של הסטודיו.', 40, 'custom', true, 'client', 'generic');
  end if;

  if not exists (select 1 from public.rewards where audience='client' and name='תרומה לצדקה בשמך') then
    insert into public.rewards (name, description, credit_cost, reward_type, is_active, audience, kind)
    values ('תרומה לצדקה בשמך', 'נתרום לעמותה לבחירתך, בשמך.', 50, 'custom', true, 'client', 'generic');
  end if;
end $$;
