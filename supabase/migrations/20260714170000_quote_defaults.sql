-- ============================================================
-- Quote defaults (Phase A polish): one studio-wide row of boilerplate that
-- seeds every new price_quote so each quote is born complete and polished.
-- Sections: differentiators ("why me"), phases/timeline, bonuses (value-stack),
-- next_steps, faq, legal clauses, payment split, validity. Admin edits it once
-- at /admin/tools/quote/defaults; the client page reads each quote's own copy
-- from price_quotes.content, so editing defaults never changes sent quotes.
-- ============================================================

create table if not exists public.quote_defaults (
  id              uuid primary key default gen_random_uuid(),
  differentiators jsonb not null default '[]'::jsonb,
  phases          jsonb not null default '[]'::jsonb,
  bonuses         jsonb not null default '[]'::jsonb,
  next_steps      jsonb not null default '[]'::jsonb,
  faq             jsonb not null default '[]'::jsonb,
  legal           jsonb not null default '[]'::jsonb,
  payment         jsonb not null default '{"deposit_pct":50}'::jsonb,
  testimonial     jsonb not null default '{}'::jsonb,
  validity_days   int   not null default 7,
  updated_at      timestamptz not null default now()
);

alter table public.quote_defaults enable row level security;

create policy "quote_defaults_admin" on public.quote_defaults
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed exactly one row (matches lib/quote.ts fallbackQuoteDefaults).
insert into public.quote_defaults (differentiators, phases, bonuses, next_steps, faq, legal, payment, testimonial, validity_days)
select
  '[
    {"id":"d1","title":"קוד מותאם אישית, בלי תבניות","desc":"אני כותב את האתר בהתאמה מלאה, כדי שיהיה מהיר, מאובטח ומדויק לעסק שלך, בלי תוספים מיותרים שמכבידים."},
    {"id":"d2","title":"פרימיום שמרגיש אחרת","desc":"עיצוב, אנימציות ומיקרו-אינטראקציות שנותנים לאתר תחושת חיים ויוקרה, ומבדלים אותך מהשוק."},
    {"id":"d3","title":"ליווי אישי לאורך כל הדרך","desc":"אתה מקבל אותי ישירות, לא סוכנות. תקשורת רציפה, פורטל מעקב, וזמינות אמיתית."}
  ]'::jsonb,
  '[
    {"id":"p1","name":"אפיון","desc":"שאלון, מפת אתר, תכנון עמודים ושרטוטי וויירפריים.","duration":""},
    {"id":"p2","name":"עיצוב","desc":"גיבוש שפה ויזואלית, פלטה ופונטים, ועיצוב כל המסכים.","duration":""},
    {"id":"p3","name":"פיתוח","desc":"בניית כל הדפים, רספונסיביות מלאה ואינטראקציות.","duration":""},
    {"id":"p4","name":"QA ועלייה לאוויר","desc":"בדיקות איכות, אופטימיזציית מהירות והשקה.","duration":""}
  ]'::jsonb,
  '[
    {"id":"b1","name":"גישה למערכת Orion למעקב הפרויקט","desc":"פורטל ניהול הפרויקט שלי, לעקוב אחרי כל שלב בראש שקט וליצור איתי קשר.","value":600},
    {"id":"b2","name":"אופטימיזציית מהירות","desc":"שיפור זמני טעינה לציון גבוה ב-PageSpeed.","value":800},
    {"id":"b3","name":"SEO טכני בסיסי","desc":"תגי מטא, מפת אתר ו-schema מוטמעים, כדי שגוגל יבין את האתר.","value":700},
    {"id":"b4","name":"הגדרת Google Analytics ו-Search Console","desc":"התקנה וחיבור מלא של כלי המדידה.","value":400},
    {"id":"b5","name":"גיבוי ענן ראשוני","desc":"גיבוי מלא של האתר אחרי ההשקה.","value":350},
    {"id":"b6","name":"30 ימי תמיכה אחרי ההשקה","desc":"מענה לשאלות ותיקוני באגים קלים ללא עלות.","value":900},
    {"id":"b7","name":"הדרכת ניהול תוכן","desc":"מפגש מוקלט לניהול האתר, ומסמך הדרכה מסודר בתוך Orion.","value":500},
    {"id":"b8","name":"פונט פרימיום","desc":"רישיון פונט בתשלום, כלול בפרויקט.","value":300}
  ]'::jsonb,
  '[
    {"id":"n1","text":"אישור וחתימה על ההצעה כאן בעמוד"},
    {"id":"n2","text":"תשלום מקדמה לשריון מקום ביומן"},
    {"id":"n3","text":"שיחת התנעה ואיסוף חומרים"},
    {"id":"n4","text":"מתחילים לעבוד, ואתה עוקב בפורטל"}
  ]'::jsonb,
  '[
    {"id":"f1","q":"כמה סבבי תיקונים כלולים?","a":"כלולים שני סבבי תיקונים מרוכזים בכל שלב. תיקונים מעבר לכך מתומחרים בנפרד ובשקיפות מלאה מראש."},
    {"id":"f2","q":"מה קורה אחרי שהאתר עולה לאוויר?","a":"מקבל 30 ימי תמיכה חינם, ואפשר להמשיך עם חבילת תחזוקה חודשית לשקט נפשי לאורך זמן."},
    {"id":"f3","q":"האתר בבעלותי המלאה?","a":"בהחלט. בסיום הפרויקט האתר והקוד עוברים אליך לחלוטין."},
    {"id":"f4","q":"כמה זמן לוקח הפרויקט?","a":"תלוי בהיקף, ונקבע יחד בשיחת ההתנעה. אני מקפיד על לו״ז ברור ועדכונים שוטפים בפורטל."}
  ]'::jsonb,
  '[
    "העבודה תבוצע על הצד הטוב ביותר לפי שיקול דעת מקצועי ובהתאם למוסכם בשיחת האפיון.",
    "סבב תיקונים משמעו מסמך מרוכז של כל הבקשות. תיקונים מעבר לסבבים המוסכמים יתומחרו בנפרד.",
    "העלאת האתר לאוויר תתבצע רק לאחר העברת התשלום המלא.",
    "לקוח שאינו מספק תכנים עד למועד המוסכם, האתר יועלה עם תכנים לדוגמה והחיוב ייגבה במועד.",
    "האחריות המשפטית לנגישות, זכויות יוצרים ותוכן האתר חלה על הלקוח. יותקן תוסף נגישות ותינתן הדרכה.",
    "לסטודיו שמורה הזכות להציג את הפרויקט בפורטפוליו ולהופיע בקרדיט בתחתית האתר.",
    "הצעת המחיר בש״ח. אישורה על ידי הלקוח מהווה אישור רשמי בכתב בעל תוקף."
  ]'::jsonb,
  '{"deposit_pct":50,"terms":"מקדמה לאישור ההצעה, והיתרה לפני העלייה לאוויר."}'::jsonb,
  '{"quote":"הגעתי לסטודיו אורי גיא לבנות אתר וזו הייתה חוויה מעולה מהתחלה ועד הסוף. קשובים, סבלניים וסופר מקצועיים, והתוצאה יצאה פגז, הרבה מעבר למה שציפיתי. ממליץ בחום.","name":"ליאור שדה","role":"Moving Art · 5 כוכבים בגוגל"}'::jsonb,
  7
where not exists (select 1 from public.quote_defaults);
