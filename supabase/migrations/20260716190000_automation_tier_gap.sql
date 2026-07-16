-- The Care→Managed price gap (500→1400) read as unjustified: Care already
-- included "עד 2 שינויים קטנים בחודש", leaving Managed's delta vague. New
-- split (per Ori): Care = reactive only (keep it running, change work billed
-- hourly), Managed = proactive (a 3-hour monthly work bank worth 1,350 at the
-- standard 450/h rate + monthly report). Wording kept generic , it describes
-- the package for any client, not one project.
update quote_maintenance_tiers
set description = 'ניטור שהאוטומציות רצות + התראת כשל, תיקון תקלות, ועדכון כשמערכת צד שלישי משתנה. שינויים ותוספות מתומחרים בנפרד לפי שעה.'
where type = 'automation' and key = 'care';

update quote_maintenance_tiers
set description = 'כל Care, ובנוסף עד 3 שעות עבודה בחודש לשינויים, שיפורים או אוטומציה חדשה (שווי 1,350 ש"ח בתעריף רגיל), ודוח חודשי עם המלצות.'
where type = 'automation' and key = 'managed';
