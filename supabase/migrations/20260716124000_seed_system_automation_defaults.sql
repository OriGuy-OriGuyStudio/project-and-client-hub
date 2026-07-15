-- ============================================================
-- Quote v2.1-C follow-up , seed starter content for system + automation
-- defaults. The per-type migration seeded only legal for these two, leaving
-- differentiators/phases/bonuses/faq/next_steps empty (website already had
-- content). This gives each type a sensible premium starter set that Ori edits
-- in the per-type defaults page. Branch DB (dbchappsqcsixxecxzqv) only.
-- ============================================================

-- ---------- SYSTEM ----------
update public.quote_defaults set
  differentiators = jsonb_build_array(
    jsonb_build_object('id','sys_d1','title',$$מערכת בהתאמה אישית$$,'desc',$$נבנית בדיוק לתהליך שלך, לא תבנית מדף.$$),
    jsonb_build_object('id','sys_d2','title',$$קוד נקי ומתועד$$,'desc',$$קל לתחזוקה ולהרחבה בעתיד, בלי להיתקע על ספק אחד.$$),
    jsonb_build_object('id','sys_d3','title',$$ממשק ברור$$,'desc',$$חוויית משתמש וניהול פשוטים, גם למי שלא טכני.$$)
  ),
  phases = jsonb_build_array(
    jsonb_build_object('id','sys_p1','name',$$אפיון ועיצוב UX$$,'desc',$$מיפוי הצרכים, זרימות המשתמש ומבנה המערכת.$$,'duration',$$1-2 שבועות$$),
    jsonb_build_object('id','sys_p2','name',$$פיתוח ליבה$$,'desc',$$בניית המודולים המרכזיים והלוגיקה.$$,'duration',$$3-5 שבועות$$),
    jsonb_build_object('id','sys_p3','name',$$אינטגרציות ובדיקות$$,'desc',$$חיבור למערכות חיצוניות ובדיקות QA.$$,'duration',$$1-2 שבועות$$),
    jsonb_build_object('id','sys_p4','name',$$העלאה והדרכה$$,'desc',$$עלייה לייצור, הדרכה ומסירה.$$,'duration',$$שבוע$$)
  ),
  bonuses = jsonb_build_array(
    jsonb_build_object('id','sys_b1','name',$$חודש תמיכה$$,'desc',$$ליווי ותיקוני באגים בחודש הראשון.$$,'value',0),
    jsonb_build_object('id','sys_b2','name',$$תיעוד המערכת$$,'desc',$$מסמך הסבר על המבנה והשימוש.$$,'value',0),
    jsonb_build_object('id','sys_b3','name',$$הדרכת צוות$$,'desc',$$מפגש הדרכה למשתמשים.$$,'value',0)
  ),
  faq = jsonb_build_array(
    jsonb_build_object('id','sys_f1','q',$$כמה זמן לוקח לפתח מערכת?$$,'a',$$תלוי בהיקף, בדרך כלל בין חודש לשלושה. נגדיר לוח זמנים מדויק אחרי האפיון.$$),
    jsonb_build_object('id','sys_f2','q',$$אפשר להוסיף פיצ'רים בהמשך?$$,'a',$$בהחלט. המערכת נבנית מודולרית כך שאפשר להרחיב בשלבים.$$),
    jsonb_build_object('id','sys_f3','q',$$מי מארח את המערכת?$$,'a',$$האחסון והשרתים באחריות הלקוח, ואנחנו מסייעים בהקמה ובהגדרה.$$),
    jsonb_build_object('id','sys_f4','q',$$מה קורה אם צריך תמיכה שוטפת?$$,'a',$$יש חבילות תחזוקה חודשיות בהתאמה לצרכים.$$)
  ),
  next_steps = jsonb_build_array(
    jsonb_build_object('id','sys_s1','text',$$אישור ההצעה$$),
    jsonb_build_object('id','sys_s2','text',$$שיחת אפיון מעמיקה$$),
    jsonb_build_object('id','sys_s3','text',$$תשלום מקדמה$$),
    jsonb_build_object('id','sys_s4','text',$$תחילת פיתוח$$)
  )
where type = 'system';

-- ---------- AUTOMATION ----------
update public.quote_defaults set
  differentiators = jsonb_build_array(
    jsonb_build_object('id','aut_d1','title',$$בנוי על n8n$$,'desc',$$בלי דמי מנוי לפי מספר פעולות, הכל על תשתית ייעודית בלי תקרת נפח.$$),
    jsonb_build_object('id','aut_d2','title',$$חיבור חכם בין המערכות שלך$$,'desc',$$עובד עם הכלים שכבר יש לך, בלי להחליף כלום.$$),
    jsonb_build_object('id','aut_d3','title',$$פחות עבודה ידנית$$,'desc',$$פחות טעויות, פחות לידים שנופלים, יותר זמן לעסק.$$)
  ),
  phases = jsonb_build_array(
    jsonb_build_object('id','aut_p1','name',$$אפיון התהליך$$,'desc',$$מיפוי הזרימה: טריגר, שלבים ופלט.$$,'duration',$$כמה ימים$$),
    jsonb_build_object('id','aut_p2','name',$$בנייה וחיבורים$$,'desc',$$הקמת n8n וחיבור המערכות.$$,'duration',$$1-2 שבועות$$),
    jsonb_build_object('id','aut_p3','name',$$בדיקות$$,'desc',$$בדיקות end-to-end וטיפול בשגיאות.$$,'duration',$$כמה ימים$$),
    jsonb_build_object('id','aut_p4','name',$$העלאה והדרכה$$,'desc',$$הפעלה, הדרכה ומסירה.$$,'duration',$$כמה ימים$$)
  ),
  bonuses = jsonb_build_array(
    jsonb_build_object('id','aut_b1','name',$$14 יום תיקונים$$,'desc',$$תיקוני תקלות אחרי ההפעלה.$$,'value',0),
    jsonb_build_object('id','aut_b2','name',$$תיעוד הזרימות$$,'desc',$$מסמך הסבר על האוטומציות שנבנו.$$,'value',0),
    jsonb_build_object('id','aut_b3','name',$$הדרכה$$,'desc',$$מפגש הסבר על התפעול והניטור.$$,'value',0)
  ),
  faq = jsonb_build_array(
    jsonb_build_object('id','aut_f1','q',$$מה זה n8n ולמה זה טוב לי?$$,'a',$$פלטפורמת אוטומציה self-hosted: אין דמי מנוי לפי פעולות ואין תקרת נפח, רק עלות אחסון.$$),
    jsonb_build_object('id','aut_f2','q',$$מה קורה אם מערכת צד ג' משתנה?$$,'a',$$נדרשת התאמה, שמטופלת בנפרד או במסגרת חבילת תחזוקה.$$),
    jsonb_build_object('id','aut_f3','q',$$כמה עולה להריץ את זה בחודש?$$,'a',$$רק עלות אחסון השרת, בלי חיוב לפי מספר פעולות.$$),
    jsonb_build_object('id','aut_f4','q',$$אפשר להוסיף אוטומציות בהמשך?$$,'a',$$כן, אפשר להרחיב בכל שלב, בנפרד או במסגרת ריטיינר.$$)
  ),
  next_steps = jsonb_build_array(
    jsonb_build_object('id','aut_s1','text',$$אישור ההצעה$$),
    jsonb_build_object('id','aut_s2','text',$$אפיון התהליכים$$),
    jsonb_build_object('id','aut_s3','text',$$תשלום מקדמה$$),
    jsonb_build_object('id','aut_s4','text',$$הקמה$$)
  )
where type = 'automation';
