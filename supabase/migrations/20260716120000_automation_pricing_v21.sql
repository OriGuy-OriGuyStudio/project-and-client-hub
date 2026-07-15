-- ============================================================
-- Quote v2.1-B , automation pricing + n8n deliverable descriptions + floor.
-- Premium repositioning: automation was underpriced (freelancer band). Raises
-- the catalog base prices, adds the "what the client gets" description per
-- package (platform = n8n self-hosted), and lifts the automation type floor.
-- Website pricing untouched. See spec 2026-07-16 §4 / §9.
-- Applied to the branch DB (dbchappsqcsixxecxzqv) only.
-- ============================================================

update public.quote_catalog set base_price = 3000,
  description = 'אפיון התהליך + מיפוי זרימה, הקמת סביבת n8n + חיבור המערכות (API/OAuth/webhooks), אוטומציה אחת עובדת, בדיקות end-to-end + טיפול שגיאות בסיסי, הדרכה + מסירה + 14 יום תיקונים.'
  where kind = 'automation' and label = 'בסיס הקמה ושילוב';

update public.quote_catalog set base_price = 2000,
  description = 'טריגר אחד, 1-2 מערכות, זרימה לינארית, בלי תנאים.'
  where kind = 'automation' and label = 'אוטומציה פשוטה';

update public.quote_catalog set base_price = 4000,
  description = '2-3 מערכות, תנאים והסתעפויות, מיפוי ועיבוד נתונים, טריגר לפי סטטוס.'
  where kind = 'automation' and label = 'אוטומציה בינונית';

update public.quote_catalog set base_price = 7000,
  description = '3+ מערכות, סנכרון דו-כיווני, לוגיקה מתקדמת, טיפול שגיאות + retry + לוגים, אופציונלי רכיב AI.'
  where kind = 'automation' and label = 'אוטומציה מורכבת';

update public.quote_type_multipliers set floor = 3500 where type = 'automation';
