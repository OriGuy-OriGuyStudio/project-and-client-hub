-- ============================================================
-- 0017 — Restructure stage templates into phases + sub-tasks
-- ============================================================
-- Each template stage becomes a major "phase" carrying a `tasks` array of
-- sub-task titles, tailored to the project type (applied as stage_tasks).

update public.stage_templates set stages = '[
  {"title":"אפיון ואיסוף חומרים","assignee":"client","tasks":["שאלון אפיון","איסוף תכנים ותמונות","אפיון מבנה האתר","הגדרת מטרות ויעדים"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב שפה גרפית","עיצוב דף הבית","עיצוב עמודים פנימיים","אישור עיצוב מול הלקוח"]},
  {"title":"פיתוח","assignee":"admin","tasks":["פיתוח דף הבית","פיתוח עמודים פנימיים","התאמה לנייד (רספונסיביות)","הזנת תכנים"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות בכל הדפדפנים","אופטימיזציית מהירות","חיבור Analytics ו-Search Console","עלייה לאוויר"]},
  {"title":"אחריות ותמיכה","assignee":"admin","tasks":["תקופת אחריות","תיקוני באגים"]}
]'::jsonb where name = 'אתר תדמית';

update public.stage_templates set stages = '[
  {"title":"אפיון ואיסוף חומרים","assignee":"client","tasks":["שאלון אפיון","איסוף תכנים ותמונות מוצרים","אפיון תהליך הרכישה","רשימת מוצרים וקטגוריות"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב שפה גרפית","עיצוב דף הבית","עיצוב עמוד מוצר ועגלה","אישור עיצוב"]},
  {"title":"פיתוח","assignee":"admin","tasks":["פיתוח החנות","הקמת מוצרים וקטלוג","הגדרת תשלום וסליקה","הגדרת משלוחים","רספונסיביות"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקת תהליך רכישה מלא","בדיקות תקינות","אופטימיזציית מהירות","חיבור Analytics","עלייה לאוויר"]},
  {"title":"אחריות ותמיכה","assignee":"admin","tasks":["תקופת אחריות","תיקוני באגים"]}
]'::jsonb where name = 'חנות אונליין';

update public.stage_templates set stages = '[
  {"title":"אפיון ומסרים","assignee":"client","tasks":["שאלון שיווקי","איסוף תכנים ותמונות","הגדרת מסר וקריאה לפעולה"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב הדף","אישור עיצוב"]},
  {"title":"פיתוח","assignee":"admin","tasks":["פיתוח הדף","חיבור טופס לידים","חיבור פיקסלים ומעקב","רספונסיביות"]},
  {"title":"בדיקות ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות","אופטימיזציית מהירות","עלייה לאוויר"]}
]'::jsonb where name = 'דף נחיתה';

update public.stage_templates set stages = '[
  {"title":"אפיון ובניית דרישות","assignee":"client","tasks":["איסוף דרישות","אפיון פונקציונלי","אפיון מסכים (Wireframes)","הגדרת הרשאות ומשתמשים"]},
  {"title":"עיצוב","assignee":"admin","tasks":["עיצוב UI/UX","עיצוב מסכים מרכזיים","אישור עיצוב"]},
  {"title":"פיתוח","assignee":"admin","tasks":["הקמת תשתית ובסיס נתונים","פיתוח Backend ו-API","פיתוח Frontend","אינטגרציות צד שלישי"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות QA","בדיקות אבטחה","אופטימיזציה","העלאה לשרת"]},
  {"title":"תחזוקה ואחריות","assignee":"admin","tasks":["תקופת אחריות","ניטור ותחזוקה"]}
]'::jsonb where name = 'אפליקציה אינטרנטית';

update public.stage_templates set stages = '[
  {"title":"אבחון ואפיון","assignee":"admin","tasks":["אבחון האתר הקיים","ניתוח ביצועים ו-SEO","אפיון שיפורים נדרשים"]},
  {"title":"עיצוב מחדש","assignee":"admin","tasks":["עיצוב שפה מחודשת","עיצוב דף הבית","עיצוב עמודים פנימיים","אישור עיצוב"]},
  {"title":"פיתוח והעברה","assignee":"admin","tasks":["פיתוח העיצוב החדש","העברת תכנים","שמירת מבנה קישורים (SEO)","רספונסיביות"]},
  {"title":"QA ועלייה לאוויר","assignee":"admin","tasks":["בדיקות תקינות","אופטימיזציית מהירות","בדיקת הפניות (Redirects)","עלייה לאוויר"]},
  {"title":"אחריות ותמיכה","assignee":"admin","tasks":["תקופת אחריות","תיקוני באגים"]}
]'::jsonb where name = 'חידוש אתר קיים (Redesign)';
