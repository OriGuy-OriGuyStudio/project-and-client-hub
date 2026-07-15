-- ============================================================
-- Quote v2.1-B , interactive-tools upsell layer + n8n cross-sell.
-- Ori's strongest differentiated upsell (proven DNA: Zamiron wizard + his own
-- AI tools). Universal (type=null) so available to any quote type. Admin curates
-- these in the defaults page. See spec 2026-07-16 §6.
-- Applied to the branch DB (dbchappsqcsixxecxzqv) only.
-- ============================================================

insert into public.quote_catalog (kind, type, label, description, base_price, default_mult, recommended, sort) values
  ('upsell', null, 'בוחן התאמה / Quiz', '3-6 שאלות ותוצאה מותאמת + לכידת ליד. ממיר יותר מבקרים ללידים איכותיים.', 3000, 1, true, 40),
  ('upsell', null, 'מחשבון / קונפיגורטור', 'לוגיקה + תמחור דינמי + תוצאה מותאמת ולכידת ליד.', 5500, 1, true, 50),
  ('upsell', null, 'כלי אינטראקטיבי מורכב', 'רב-שלבי, מיפוי מותאם, חיבור n8n/CRM ודשבורד לידים.', 10000, 1, false, 60),
  ('upsell', null, 'אוטומציה נלווית (n8n)', 'חיבור אוטומטי של האתר למערכות שלך: ליד ← CRM + וואטסאפ, ללא עבודה ידנית.', 3000, 1, false, 70);
