-- ============================================================
-- 0018 — Templates: add payments (start/end), a Wireframe phase,
-- and a client-approval revision round after each major phase
-- ============================================================

update public.stage_templates set stages = '[
  {"title":"תשלום מקדמה","assignee":"client","tasks":["תשלום מקדמה לאישור תחילת העבודה"]},
  {"title":"אפיון ואיסוף חומרים","assignee":"client","tasks":["שאלון אפיון","איסוף תכנים ותמונות","הגדרת מטרות ויעדים"]},
  {"title":"Wireframe","assignee":"admin","tasks":["אפיון מבנה ומסכים","שרטוט Wireframe"]},
  {"title":"סבב תיקונים ואישור Wireframe","assignee":"client","tasks":["מעבר על ה-Wireframe","אישור או בקשת תיקונים"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב שפה גרפית","עיצוב דף הבית","עיצוב עמודים פנימיים"]},
  {"title":"סבב תיקונים ואישור עיצוב","assignee":"client","tasks":["מעבר על העיצוב","אישור או בקשת תיקונים"]},
  {"title":"פיתוח","assignee":"admin","tasks":["פיתוח דף הבית","פיתוח עמודים פנימיים","התאמה לנייד (רספונסיביות)","הזנת תכנים"]},
  {"title":"סבב תיקונים ואישור","assignee":"client","tasks":["מעבר על האתר","אישור או בקשת תיקונים"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות","אופטימיזציית מהירות","חיבור Analytics","עלייה לאוויר"]},
  {"title":"תשלום סופי","assignee":"client","tasks":["תשלום יתרה לפני עלייה לאוויר"]},
  {"title":"אחריות ותמיכה","assignee":"admin","tasks":["תקופת אחריות","תיקוני באגים"]}
]'::jsonb where name = 'אתר תדמית';

update public.stage_templates set stages = '[
  {"title":"תשלום מקדמה","assignee":"client","tasks":["תשלום מקדמה לאישור תחילת העבודה"]},
  {"title":"אפיון ואיסוף חומרים","assignee":"client","tasks":["שאלון אפיון","איסוף תכנים ותמונות מוצרים","רשימת מוצרים וקטגוריות"]},
  {"title":"Wireframe","assignee":"admin","tasks":["אפיון תהליך הרכישה","שרטוט Wireframe"]},
  {"title":"סבב תיקונים ואישור Wireframe","assignee":"client","tasks":["מעבר על ה-Wireframe","אישור או בקשת תיקונים"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב שפה גרפית","עיצוב דף הבית","עיצוב עמוד מוצר ועגלה"]},
  {"title":"סבב תיקונים ואישור עיצוב","assignee":"client","tasks":["מעבר על העיצוב","אישור או בקשת תיקונים"]},
  {"title":"פיתוח","assignee":"admin","tasks":["פיתוח החנות","הקמת מוצרים וקטלוג","הגדרת תשלום וסליקה","הגדרת משלוחים","רספונסיביות"]},
  {"title":"סבב תיקונים ואישור","assignee":"client","tasks":["בדיקת תהליך רכישה","אישור או בקשת תיקונים"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות","אופטימיזציית מהירות","חיבור Analytics","עלייה לאוויר"]},
  {"title":"תשלום סופי","assignee":"client","tasks":["תשלום יתרה לפני עלייה לאוויר"]},
  {"title":"אחריות ותמיכה","assignee":"admin","tasks":["תקופת אחריות","תיקוני באגים"]}
]'::jsonb where name = 'חנות אונליין';

update public.stage_templates set stages = '[
  {"title":"תשלום מקדמה","assignee":"client","tasks":["תשלום מקדמה לאישור תחילת העבודה"]},
  {"title":"אפיון ומסרים","assignee":"client","tasks":["שאלון שיווקי","איסוף תכנים ותמונות","הגדרת מסר וקריאה לפעולה"]},
  {"title":"Wireframe","assignee":"admin","tasks":["אפיון מבנה הדף","שרטוט Wireframe"]},
  {"title":"סבב תיקונים ואישור Wireframe","assignee":"client","tasks":["מעבר על ה-Wireframe","אישור או בקשת תיקונים"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב הדף"]},
  {"title":"סבב תיקונים ואישור עיצוב","assignee":"client","tasks":["מעבר על העיצוב","אישור או בקשת תיקונים"]},
  {"title":"פיתוח","assignee":"admin","tasks":["פיתוח הדף","חיבור טופס לידים","חיבור פיקסלים ומעקב","רספונסיביות"]},
  {"title":"סבב תיקונים ואישור","assignee":"client","tasks":["מעבר על הדף","אישור או בקשת תיקונים"]},
  {"title":"בדיקות ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות","אופטימיזציית מהירות","עלייה לאוויר"]},
  {"title":"תשלום סופי","assignee":"client","tasks":["תשלום יתרה לפני עלייה לאוויר"]}
]'::jsonb where name = 'דף נחיתה';

update public.stage_templates set stages = '[
  {"title":"תשלום מקדמה","assignee":"client","tasks":["תשלום מקדמה לאישור תחילת העבודה"]},
  {"title":"אפיון ובניית דרישות","assignee":"client","tasks":["איסוף דרישות","אפיון פונקציונלי","הגדרת הרשאות ומשתמשים"]},
  {"title":"Wireframe","assignee":"admin","tasks":["אפיון מסכים","שרטוט Wireframe"]},
  {"title":"סבב תיקונים ואישור Wireframe","assignee":"client","tasks":["מעבר על ה-Wireframe","אישור או בקשת תיקונים"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב UI/UX","עיצוב מסכים מרכזיים"]},
  {"title":"סבב תיקונים ואישור עיצוב","assignee":"client","tasks":["מעבר על העיצוב","אישור או בקשת תיקונים"]},
  {"title":"פיתוח","assignee":"admin","tasks":["הקמת תשתית ובסיס נתונים","פיתוח Backend ו-API","פיתוח Frontend","אינטגרציות צד שלישי"]},
  {"title":"סבב תיקונים ואישור","assignee":"client","tasks":["מעבר על המערכת","אישור או בקשת תיקונים"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות QA","בדיקות אבטחה","אופטימיזציה","העלאה לשרת"]},
  {"title":"תשלום סופי","assignee":"client","tasks":["תשלום יתרה לפני עלייה לאוויר"]},
  {"title":"תחזוקה ואחריות","assignee":"admin","tasks":["תקופת אחריות","ניטור ותחזוקה"]}
]'::jsonb where name = 'אפליקציה אינטרנטית';

update public.stage_templates set stages = '[
  {"title":"תשלום מקדמה","assignee":"client","tasks":["תשלום מקדמה לאישור תחילת העבודה"]},
  {"title":"אבחון ואפיון","assignee":"admin","tasks":["אבחון האתר הקיים","ניתוח ביצועים ו-SEO","אפיון שיפורים נדרשים"]},
  {"title":"Wireframe","assignee":"admin","tasks":["אפיון מבנה מחודש","שרטוט Wireframe"]},
  {"title":"סבב תיקונים ואישור Wireframe","assignee":"client","tasks":["מעבר על ה-Wireframe","אישור או בקשת תיקונים"]},
  {"title":"עיצוב מחדש","assignee":"admin","tasks":["עיצוב שפה מחודשת","עיצוב דף הבית","עיצוב עמודים פנימיים"]},
  {"title":"סבב תיקונים ואישור עיצוב","assignee":"client","tasks":["מעבר על העיצוב","אישור או בקשת תיקונים"]},
  {"title":"פיתוח והעברה","assignee":"admin","tasks":["פיתוח העיצוב החדש","העברת תכנים","שמירת מבנה קישורים (SEO)","רספונסיביות"]},
  {"title":"סבב תיקונים ואישור","assignee":"client","tasks":["מעבר על האתר","אישור או בקשת תיקונים"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות","בדיקת הפניות (Redirects)","אופטימיזציית מהירות","עלייה לאוויר"]},
  {"title":"תשלום סופי","assignee":"client","tasks":["תשלום יתרה לפני עלייה לאוויר"]},
  {"title":"אחריות ותמיכה","assignee":"admin","tasks":["תקופת אחריות","תיקוני באגים"]}
]'::jsonb where name = 'חידוש אתר קיים (Redesign)';
