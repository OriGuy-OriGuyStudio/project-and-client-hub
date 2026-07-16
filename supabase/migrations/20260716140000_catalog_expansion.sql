-- ============================================================
-- Quote v2.4 , catalog expansion (more pages, features, modules, named
-- automations) so the builder covers more of what clients actually ask for.
-- Prices ex-VAT, premium positioning; Ori adjusts as needed. Branch DB only.
-- ============================================================

insert into public.quote_catalog (kind, type, label, base_price, default_mult, recommended, sort) values
  -- website pages
  ('page','website','עמוד נחיתה ייעודי',1800,1,false,240),
  ('page','website','עמוד המלצות וביקורות',900,1,false,250),
  ('page','website','עמוד צוות',1000,1,false,260),
  ('page','website','עמוד קריירה ודרושים',1000,1,false,270),
  ('page','website','עמוד מאמר בודד',600,1,false,280),
  ('page','website','אזור לקוחות / חברים',2500,1,false,290),
  ('page','website','עמוד תקנון ומדיניות פרטיות',500,1,false,300),
  ('page','website','עמוד השוואת חבילות',1200,1,false,310),
  ('page','website','עמוד הזמנת תור',1500,1,false,320),
  ('page','website','דף מכירה ארוך',2500,1,false,330),
  -- website features
  ('feature','website','צ׳אט / וואטסאפ צף',600,1,false,420),
  ('feature','website','פופאפ ולכידת לידים',700,1,false,430),
  ('feature','website','מפת גוגל וסניפים',600,1,false,440),
  ('feature','website','ספירה לאחור / טיימר',500,1,false,450),
  ('feature','website','גלריית וידאו',800,1,false,460),
  ('feature','website','אזור הורדות ומסמכים',900,1,false,470),
  ('feature','website','דירוגים וביקורות',1000,1,false,480),
  ('feature','website','מצב לילה',700,1,false,490),
  ('feature','website','הגדרת מדידה (GA4 ופיקסלים)',800,1,false,500),
  ('feature','website','אינטגרציית מערכת דיוור',900,1,false,510),
  -- system modules
  ('module','system','ניהול הזמנות',3000,1,false,630),
  ('module','system','ניהול מלאי',2800,1,false,640),
  ('module','system','CRM וניהול לקוחות',3500,1,false,650),
  ('module','system','ניהול לידים ומכירות',3000,1,false,660),
  ('module','system','מערכת תמיכה וכרטוס',2800,1,false,670),
  ('module','system','ניהול מנויים וחיובים חוזרים',3000,1,false,680),
  ('module','system','לוגים וביקורת',1800,1,false,690),
  ('module','system','ניהול מסמכים',2000,1,false,700),
  ('module','system','מערכת נאמנות ונקודות',2500,1,false,710),
  ('module','system','דוחות מתקדמים ו-BI',3500,1,false,720),
  ('module','system','ריבוי ארגונים (multi-tenancy)',4000,1,false,730),
  ('module','system','ניהול משימות ופרויקטים',2800,1,false,740),
  -- named automations (common client requests)
  ('automation','automation','ליד מטופס אל CRM + וואטסאפ',2000,1,false,750),
  ('automation','automation','תזכורות אוטומטיות (SMS/וואטסאפ/מייל)',1800,1,false,760),
  ('automation','automation','הזמנה אל חשבונית + עדכון מלאי',3000,1,false,770),
  ('automation','automation','סנכרון דו-כיווני בין מערכות',5000,1,false,780),
  ('automation','automation','דוחות אוטומטיים תקופתיים',2000,1,false,790),
  ('automation','automation','onboarding לקוח אוטומטי',3000,1,false,800),
  ('automation','automation','רצף follow-up אוטומטי',2500,1,false,810),
  ('automation','automation','ניתוב פניות אוטומטי',2500,1,false,820);
