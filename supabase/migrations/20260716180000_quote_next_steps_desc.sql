-- Next-steps timeline content: bare 2-word step titles read empty on the
-- client page (Ori: "חסר לי תוכן זה נראה מסכן"). QuoteStep now carries an
-- optional `desc` rendered under the title (same layout as the phases
-- timeline), and all three types get title + explainer seeds in Ori's voice.
-- Applied to quote_defaults (future quotes) and merged into existing
-- draft/sent quotes that still carry the default step ids. Signed quotes are
-- immutable and untouched.

do $mig$
declare
  v_website jsonb := $j$[
    {"id":"n1","text":"אישור וחתימה על ההצעה","desc":"חותמים כאן בעמוד, בלי ניירת ובלי הדפסות. מהרגע הזה הפרויקט שלכם נכנס ללוח שלי."},
    {"id":"n2","text":"תשלום מקדמה","desc":"המקדמה משריינת לכם מקום ביומן ומניעה את הפרויקט לדרך."},
    {"id":"n3","text":"שיחת התנעה ואיסוף חומרים","desc":"עוברים יחד על התכנים, התמונות וההשראות, ומגדירים איך האתר צריך להרגיש."},
    {"id":"n4","text":"מתחילים לעבוד","desc":"אני בונה, ואתם עוקבים אחרי כל שלב בפורטל האישי שלכם, כולל עדכונים ואישורים."}
  ]$j$;
  v_automation jsonb := $j$[
    {"id":"aut_s1","text":"אישור ההצעה","desc":"חתימה כאן בעמוד, וזה כל מה שצריך כדי לצאת לדרך."},
    {"id":"aut_s2","text":"אפיון התהליכים","desc":"שיחה ממוקדת שבה יורדים יחד לפרטים: מאיפה מגיע המידע, לאן הוא צריך לזרום ומה קורה בכל שלב בדרך."},
    {"id":"aut_s3","text":"תשלום מקדמה","desc":"המקדמה משריינת מקום ביומן, ומיד אחריה אני מתחיל בהקמה."},
    {"id":"aut_s4","text":"הקמה והרצה","desc":"אני בונה את האוטומציה, מריץ בדיקות על תרחישים אמיתיים ומעביר לכם אותה רק כשהיא רצה חלק."}
  ]$j$;
  v_system jsonb := $j$[
    {"id":"sys_s1","text":"אישור ההצעה","desc":"חתימה כאן בעמוד, בלי ניירת ובלי בירוקרטיה."},
    {"id":"sys_s2","text":"שיחת אפיון מעמיקה","desc":"יורדים יחד לפרטים: מסכים, הרשאות, תהליכי עבודה וכל מה שהמערכת צריכה לדעת לעשות."},
    {"id":"sys_s3","text":"תשלום מקדמה","desc":"המקדמה משריינת מקום ביומן, ומשם הפרויקט נכנס לעבודה."},
    {"id":"sys_s4","text":"תחילת פיתוח","desc":"אני בונה שלב אחרי שלב, ואתם רואים התקדמות בדרך ונותנים פידבק שמכוון את ההמשך."}
  ]$j$;
begin
  update quote_defaults set next_steps = v_website,    updated_at = now() where type = 'website';
  update quote_defaults set next_steps = v_automation, updated_at = now() where type = 'automation';
  update quote_defaults set next_steps = v_system,     updated_at = now() where type = 'system';

  -- Existing live quotes: replace next_steps only where EVERY current step id
  -- belongs to that type's default set (i.e. the section was never customized
  -- with admin-added steps). Text edits inside default steps are overwritten
  -- on purpose: the whole point is upgrading the thin default copy.
  update price_quotes q
  set content = jsonb_set(q.content, '{next_steps}', v_website)
  where q.status in ('draft','sent')
    and q.content->>'type' = 'website'
    and jsonb_array_length(coalesce(q.content->'next_steps','[]'::jsonb)) > 0
    and not exists (
      select 1 from jsonb_array_elements(q.content->'next_steps') e
      where e->>'id' not in ('n1','n2','n3','n4')
    );

  update price_quotes q
  set content = jsonb_set(q.content, '{next_steps}', v_automation)
  where q.status in ('draft','sent')
    and q.content->>'type' = 'automation'
    and jsonb_array_length(coalesce(q.content->'next_steps','[]'::jsonb)) > 0
    and not exists (
      select 1 from jsonb_array_elements(q.content->'next_steps') e
      where e->>'id' not in ('aut_s1','aut_s2','aut_s3','aut_s4')
    );

  update price_quotes q
  set content = jsonb_set(q.content, '{next_steps}', v_system)
  where q.status in ('draft','sent')
    and q.content->>'type' = 'system'
    and jsonb_array_length(coalesce(q.content->'next_steps','[]'::jsonb)) > 0
    and not exists (
      select 1 from jsonb_array_elements(q.content->'next_steps') e
      where e->>'id' not in ('sys_s1','sys_s2','sys_s3','sys_s4')
    );
end
$mig$;
