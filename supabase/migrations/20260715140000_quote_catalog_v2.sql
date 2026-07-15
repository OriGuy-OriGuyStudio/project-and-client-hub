-- ============================================================
-- Quote system v2 , catalog: add a `type` column so page/feature/module/
-- automation rows are scoped to the quote type (website/system/automation),
-- then seed the v2 catalog (premium-calibrated starting values, editable).
-- Universal upsells keep type = null. See spec §2.5 / §10.
-- ============================================================

alter table public.quote_catalog
  add column if not exists type text
    check (type is null or type in ('website','system','automation'));

-- fresh v2 seed (catalog is config, not user data; dev branch)
delete from public.quote_catalog where kind in ('subtype','page','feature','module','automation');

insert into public.quote_catalog (kind, type, site_type, label, base_price, default_mult, sort) values
  ('subtype','website',null,'דף נחיתה',2500,1,10),
  ('subtype','website',null,'אתר תדמית',4000,1,20),
  ('subtype','website',null,'חנות',6000,1,30),
  ('subtype','website',null,'קטלוג',4500,1,40),
  ('subtype','website',null,'אתר תוכן / מגזין',4000,1,50),
  ('subtype','website',null,'אתר אירוע',3500,1,60),
  ('subtype','website',null,'מיקרו-סייט קמפיין',3000,1,70),
  ('subtype','website',null,'אתר חד-עמודי',2500,1,80),
  ('page','website',null,'עמוד בית',2500,1,100),
  ('page','website',null,'אודות',1200,1,110),
  ('page','website',null,'שירותים',1500,1,120),
  ('page','website',null,'עמוד שירות בודד',1000,1,130),
  ('page','website',null,'גלריה / פורטפוליו',2000,1,140),
  ('page','website',null,'עמוד פרויקט בודד',1200,1,150),
  ('page','website',null,'בלוג',1800,1,160),
  ('page','website',null,'צור קשר',1200,1,170),
  ('page','website',null,'שאלות נפוצות',800,1,180),
  ('page','website',null,'מחירון',1000,1,190),
  ('page','website',null,'עמוד מוצר',1800,1,200),
  ('page','website',null,'קטגוריה',1200,1,210),
  ('page','website',null,'סל ותשלום',2500,1,220),
  ('page','website',null,'עמוד תודה',400,1,230),
  ('feature','website',null,'מערכת ניהול תוכן',1500,1,300),
  ('feature','website',null,'טפסים מתקדמים',1000,1,310),
  ('feature','website',null,'רב-לשוני',1800,1,320),
  ('feature','website',null,'אזור אישי / התחברות',2500,1,330),
  ('feature','website',null,'סליקה ותשלום',2000,1,340),
  ('feature','website',null,'תיאום פגישות',1800,1,350),
  ('feature','website',null,'חיפוש ופילטרים',1200,1,360),
  ('feature','website',null,'אנימציות מתקדמות',1500,1,370),
  ('feature','website',null,'אינטגרציית CRM / וואטסאפ',1200,1,380),
  ('feature','website',null,'הקמת ניוזלטר',800,1,390),
  ('feature','website',null,'נגישות מלאה',1000,1,400),
  ('feature','website',null,'SEO טכני מוטמע',800,1,410),
  ('module','system',null,'דשבורד ניהול',4000,1,500),
  ('module','system',null,'ניהול משתמשים והרשאות',3000,1,510),
  ('module','system',null,'אימות והרשמה',1500,1,520),
  ('module','system',null,'דוחות ואנליטיקס',2500,1,530),
  ('module','system',null,'התראות ומיילים',1200,1,540),
  ('module','system',null,'תשלומים ומנויים',3000,1,550),
  ('module','system',null,'אינטגרציית API חיצוני',2500,1,560),
  ('module','system',null,'ייבוא וייצוא נתונים',1200,1,570),
  ('module','system',null,'לוח שנה ותזמון',2000,1,580),
  ('module','system',null,'צ׳אט ומסרים',2500,1,590),
  ('module','system',null,'חיפוש מתקדם',1500,1,600),
  ('module','system',null,'אפליקציית מובייל / PWA',2500,1,610),
  ('module','system',null,'אוטומציות פנימיות',2000,1,620),
  ('automation','automation',null,'בסיס הקמה ושילוב',1000,1,700),
  ('automation','automation',null,'אוטומציה פשוטה',800,1,710),
  ('automation','automation',null,'אוטומציה בינונית',1500,1,720),
  ('automation','automation',null,'אוטומציה מורכבת',2800,1,730);
