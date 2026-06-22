// Fixed questionnaire templates for the discovery / characterization call.
// The questions live in code (they're standard for the studio); each session
// only stores the answers keyed by question id.

export interface DiscoveryQuestion {
  id: string;
  q: string;
  hint?: string;
  /** Ready-made professional phrasings — click to insert into the answer. */
  chips?: string[];
}
export interface DiscoverySection {
  key: string;
  title: string;
  questions: DiscoveryQuestion[];
}

/** Ice-breaker / personal section — opens the call, builds the relationship.
 *  Internal by default (these answers help me, not the client summary). */
const PERSONAL: DiscoverySection = {
  key: "personal",
  title: "היכרות אישית (שובר קרח)",
  questions: [
    {
      id: "pers_about",
      q: "ספר/י לי קצת עליך",
      hint: "מי האדם שמאחורי העסק? מה הסיפור האישי שהביא לכאן?",
    },
    {
      id: "pers_origin",
      q: "איך הגעת אליי / איך שמעת על הסטודיו?",
      hint: "כדי להבין מאיפה מגיעים הלקוחות הכי טובים",
      chips: [
        "המלצה מחבר / לקוח",
        "חיפוש בגוגל",
        "רשתות חברתיות (אינסטגרם / פייסבוק)",
        "פרויקט / אתר שראית",
        "שותף / משווק",
      ],
    },
    {
      id: "pers_trigger",
      q: "למה דווקא עכשיו?",
      hint: "מה גרם להחלטה להקים / לחדש את האתר ברגע הזה?",
      chips: [
        "השקת עסק חדש",
        "צמיחה ויותר ביקוש",
        "האתר הקיים מיושן",
        "מיתוג מחדש",
        "הרחבת מוצרים / שירותים",
      ],
    },
    {
      id: "pers_passion",
      q: "מה הכי כיף לך בעבודה שלך?",
      hint: "מה מצית אותך, במה את/ה הכי גאה? (זהב לטקסטים ולמסר באתר)",
    },
    {
      id: "pers_comm",
      q: "איך הכי נוח לך לתקשר?",
      hint: "ערוץ מועדף ושעות נוחות לאורך הפרויקט",
      chips: ["וואטסאפ", "טלפון", "מייל", "פגישות זום", "פגישות פרונטליות"],
    },
    {
      id: "pers_personal",
      q: "משהו אישי שכדאי לי לדעת?",
      hint: "תחביבים, משפחה, יום הולדת, כל פרט קטן שיעזור לי לבנות קשר אישי",
    },
  ],
};

/** My discovery-call additions — the "get to know the project" part. */
const DISCOVERY: DiscoverySection = {
  key: "discovery",
  title: "היכרות עם הפרויקט",
  questions: [
    {
      id: "disc_timeline",
      q: "לוח זמנים / דדליין?",
      hint: "יש תאריך יעד או אירוע?",
      chips: ["דחוף (עד חודש)", "1–2 חודשים", "2–4 חודשים", "גמיש", "לפני אירוע / תאריך יעד"],
    },
    {
      id: "disc_decision",
      q: "מי מקבל ההחלטות מצד הלקוח?",
      hint: "איש קשר + מי מאשר בסוף",
      chips: [
        "בעל/ת העסק (החלטה יחידה)",
        "שני שותפים",
        "צוות / ועדה שצריך לאשר",
        "איש קשר אחד מטעם הלקוח",
        "מאשר/ת חיצוני/ת (בן/בת זוג, מנהל/ת)",
      ],
    },
    { id: "disc_competitors", q: "מתחרים עיקריים ואתרים שאהבת", hint: "קישורים + מה אהבת בכל אחד" },
    {
      id: "disc_kpi",
      q: "איך נמדדת הצלחה?",
      hint: "לידים / מכירות / חשיפה / הרשמות",
      chips: ["לידים ופניות", "מכירות והכנסות", "חשיפה ומיתוג", "הרשמות לרשימת תפוצה", "תיאום פגישות"],
    },
    {
      id: "disc_assets",
      q: "אילו חומרים כבר קיימים?",
      hint: "לוגו, מיתוג, תמונות, טקסטים, סרטונים",
      chips: ["לוגו קיים", "מיתוג מלא מנוסח", "תמונות מקצועיות", "טקסטים מוכנים", "כמעט כלום — נתחיל מאפס"],
    },
    {
      id: "disc_marketing",
      q: "ערוצי שיווק נוכחיים",
      hint: "אורגני / ממומן / רשתות / דיוור",
      chips: [
        "אורגני / SEO",
        "ממומן Google",
        "ממומן Meta (פייסבוק/אינסטגרם)",
        "רשתות חברתיות",
        "דיוור",
        "המלצות מפה לאוזן",
        "אין כרגע",
      ],
    },
    {
      id: "disc_style",
      q: "העדפות עיצוביות וטון",
      hint: "סגנון, צבעים, רפרנסים, שפה",
      chips: [
        "מינימליסטי ונקי",
        "יוקרתי / פרימיום",
        "צבעוני ותוסס",
        "חם ואישי",
        "מודרני וטכנולוגי",
        "קלאסי ואלגנטי",
      ],
    },
  ],
};

/** Legal/accessibility options — relevant to every site type, so it lives in BASIC. */
const LEGAL_CHIPS = ["נדרש תקנון + הצהרת נגישות", "הצהרת נגישות בלבד", "אין צורך כרגע"];

/** Studio basic characterization questionnaire (the must-have set). */
const BASIC: DiscoverySection = {
  key: "basic",
  title: "אפיון בסיסי",
  questions: [
    {
      id: "basic_goal",
      q: "מה מטרת האתר?",
      hint: "למה צריך אתר? איזו בעיה הוא פותר? לחסוך זמן / יותר לקוחות / למצב את העסק / לשדר תדמית?",
      chips: [
        "הגדלת פניות ולידים איכותיים",
        "הגדלת מכירות אונליין",
        "מיתוג ומיצוב כמובילים בתחום",
        "הצגת תיק עבודות ואמינות",
        "תיאום פגישות / קביעת תורים",
        "מתן מידע ושירות ללקוחות קיימים",
      ],
    },
    {
      id: "basic_who",
      q: "מי עומד מאחורי האתר?",
      hint: "אדם / גוף / ארגון / מותג / חנות? איזה הסמכות ותעודות? כמה שנים בתחום? מה הסיפור?",
      chips: [
        "עצמאי/ת / פרילנסר/ית",
        "עסק קטן / משפחתי",
        "חברה / ארגון",
        "מותג מסחרי",
        "ארגון ללא מטרות רווח",
      ],
    },
    {
      id: "basic_why",
      q: "למה שיבחרו בכם?",
      hint: "למה שיקנו דווקא ממך? מה נקודת הבידול? מה המתחרים עושים ולמה שלא יקנו מהם?",
      chips: [
        "שירות אישי וליווי צמוד",
        "ניסיון ומומחיות בתחום",
        "איכות וחומרי גלם מעולים",
        "זמינות ומהירות תגובה",
        "מחיר תחרותי ושקיפות",
        "חדשנות וטכנולוגיה",
      ],
    },
    {
      id: "basic_offer",
      q: "מה השירותים / המוצרים?",
      hint: "רשימה מדויקת של הקטגוריות / שירותים / מוצרים שהמותג מציע",
      chips: [
        "שירות אחד מרכזי",
        "כמה שירותים / חבילות",
        "קטלוג מוצרים פיזיים",
        "מוצרים דיגיטליים",
        "שילוב שירות + מוצר",
      ],
    },
    {
      id: "basic_audience",
      q: "מי קהל היעד?",
      hint: "מי צפוי להיכנס לאתר ומה הוא צריך לעשות שם? מה הדרך הכי טובה לפנות אליו ומה חשוב לו לראות?",
      chips: ["עסקים (B2B)", "לקוחות פרטיים (B2C)", "קהל מקומי / אזורי", "קהל ארצי", "נישה ספציפית"],
    },
    {
      id: "basic_journey",
      q: "איזה תהליך עובר אצלך הלקוח?",
      hint: "מה השלבים שלקוח פוטנציאלי עובר אצלך? איך נציג זאת באתר כדי שהתוכנית תהיה ברורה?",
      chips: [
        "פנייה → שיחת ייעוץ → הצעה → סגירה",
        "השארת פרטים → חזרה טלפונית",
        "רכישה ישירה באתר",
        "תיאום פגישת היכרות",
        "הורדת חומר → ניוזלטר → מכירה",
      ],
    },
    {
      id: "basic_today",
      q: "מה יש לך כיום?",
      hint: "איך מגיעים לקוחות? יש אתר נוכחי? איך העסק רץ עד היום ומה צריך לשפר?",
      chips: [
        "אתר קיים שצריך שדרוג",
        "דף נחיתה ישן בלבד",
        "רק עמודי רשתות חברתיות",
        "אין נוכחות דיגיטלית",
        "לקוחות מגיעים מהמלצות",
        "לקוחות מפרסום ממומן",
      ],
    },
    {
      id: "basic_future",
      q: "מי תהיה עוד חמש שנים?",
      hint: "לאן אתה רוצה להגיע? איזו תדמית עתידית נראה באתר כדי לקחת אותך לשם הכי מהר?",
      chips: [
        "מותג מוביל בתחום",
        "הרחבה לקהל ארצי",
        "פתיחת סניפים / צוות גדל",
        "מעבר מלא לאונליין",
        "כניסה לשווקים חדשים",
      ],
    },
    { id: "basic_legal", q: "תקנון / תנאי שימוש / נגישות?", chips: LEGAL_CHIPS },
  ],
};

/** Extra for brochure / landing sites. */
const LANDING_EXT: DiscoverySection = {
  key: "landing_ext",
  title: "אפיון מורחב — תדמית / נחיתה",
  questions: [
    {
      id: "land_content_supply",
      q: "מי יספק את התכנים?",
      hint: "תמונות / סרטונים / מסמכים / תוכן כתוב",
      chips: [
        "הלקוח יספק את כל התכנים",
        "הסטודיו יפיק (קופירייטינג / צילום)",
        "שילוב — חלק מהלקוח וחלק מהסטודיו",
      ],
    },
    {
      id: "land_content_input",
      q: "מי יזין את התכנים לאתר?",
      chips: ["הסטודיו יזין", "הלקוח יזין לאחר הדרכה"],
    },
    {
      id: "land_thirdparty",
      q: "צורך בממשק למערכת צד ג'?",
      hint: "מערכת דיוור / CRM / יומן / ניוזלטר",
      chips: [
        "מערכת דיוור (ActiveTrail / Mailchimp)",
        "מערכת CRM",
        "מערכת לקביעת תורים",
        "וואטסאפ עסקי",
        "ללא צורך",
      ],
    },
  ],
};

/** Extra for e-commerce sites. */
const STORE_EXT: DiscoverySection = {
  key: "store_ext",
  title: "אפיון מורחב — חנות",
  questions: [
    {
      id: "store_payment",
      q: "ספק סליקה נוכחי לעסק?",
      chips: ["Tranzila", "PayPlus", "Cardcom", "Meshulam", "PayPal", "אין עדיין — נמליץ"],
    },
    {
      id: "store_inventory",
      q: "מערכת מלאי / קופות / צורך באינטגרציה?",
      chips: ["ללא ניהול מלאי", "ניהול מלאי בסיסי באתר", "אינטגרציה למערכת קיימת"],
    },
    {
      id: "store_catalog",
      q: "סדר המוצרים ושיטת ההעלאה?",
      hint: "מי מעלה את המוצרים?",
      chips: ["הסטודיו יעלה את המוצרים", "הלקוח יעלה לאחר הדרכה", "ייבוא מקובץ (CSV / אקסל)"],
    },
    {
      id: "store_shipping",
      q: "אפשרויות המשלוח?",
      chips: [
        "משלוח עד הבית (שליח)",
        "איסוף עצמי",
        "דואר רשום",
        "אינטגרציה לחברת שילוח",
        "משלוח חינם מעל סכום",
      ],
    },
  ],
};

/** Extra for complex systems / web apps (member areas, dashboards, SaaS, CRMs). */
const SYSTEM_EXT: DiscoverySection = {
  key: "system_ext",
  title: "אפיון מורחב — מערכת / אפליקציה",
  questions: [
    {
      id: "sys_type",
      q: "איזה סוג מערכת?",
      hint: "מה הליבה של מה שבונים?",
      chips: [
        "אזור אישי / דשבורד ללקוחות",
        "מערכת ניהול (CRM / ERP)",
        "פלטפורמה דו-צדדית (Marketplace)",
        "אפליקציית SaaS",
        "מערכת הזמנות / תורים",
        "אזור חברים / קהילה",
      ],
    },
    {
      id: "sys_roles",
      q: "אילו סוגי משתמשים והרשאות?",
      hint: "מי נכנס למערכת ומה כל אחד רשאי לעשות?",
      chips: [
        "מנהל (אדמין)",
        "צוות / עורך",
        "משתמש רשום",
        "לקוח קצה",
        "אורח ללא הרשמה",
        "הרשאות מדורגות",
      ],
    },
    {
      id: "sys_auth",
      q: "איך משתמשים מתחברים?",
      chips: [
        "אימייל + סיסמה",
        "Google / רשתות חברתיות",
        "SMS / קוד חד-פעמי",
        "SSO ארגוני",
        "הזמנה בלבד (whitelist)",
        "ללא התחברות",
      ],
    },
    {
      id: "sys_core",
      q: "מה הפעולות המרכזיות במערכת?",
      hint: "מה המשתמש בא לעשות? תהליך הליבה מתחילתו ועד סופו",
    },
    {
      id: "sys_data",
      q: "אילו נתונים נשמרים ומנוהלים?",
      hint: "הישויות העיקריות: לקוחות, הזמנות, מסמכים, מוצרים, פניות…",
    },
    {
      id: "sys_integrations",
      q: "אינטגרציות למערכות חיצוניות?",
      hint: "למה צריך להתחבר?",
      chips: [
        "סליקה / תשלומים",
        "CRM קיים",
        "מערכת דיוור",
        "WhatsApp / SMS",
        "יומן (Google / Outlook)",
        "API של צד ג'",
        "מערכת ארגונית קיימת",
        "ללא צורך",
      ],
    },
    {
      id: "sys_notifications",
      q: "התראות ותקשורת אוטומטית?",
      chips: [
        "מיילים אוטומטיים",
        "התראות SMS / WhatsApp",
        "התראות בתוך המערכת (פעמון)",
        "דוחות תקופתיים",
        "ללא צורך",
      ],
    },
    {
      id: "sys_admin",
      q: "מה אזור הניהול צריך לאפשר?",
      hint: "מה האדמין מנהל? תוכן, משתמשים, הזמנות, הרשאות, הגדרות, דוחות?",
    },
    {
      id: "sys_scale",
      q: "היקף וביצועים צפויים?",
      hint: "כמה משתמשים ועומסים צפויים?",
      chips: [
        "עשרות משתמשים",
        "מאות משתמשים",
        "אלפי משתמשים ומעלה",
        "עומסי שיא (קמפיינים / אירועים)",
        "עדיין לא ידוע",
      ],
    },
    {
      id: "sys_existing",
      q: "יש מערכת קיימת או מעבר נתונים?",
      chips: [
        "מערכת חדשה מאפס",
        "החלפת מערכת קיימת",
        "ייבוא נתונים קיימים",
        "אינטגרציה לצד מערכת קיימת",
      ],
    },
  ],
};

export interface DiscoveryTemplate {
  key: string;
  label: string;
  sections: DiscoverySection[];
}

export const DISCOVERY_TEMPLATES: DiscoveryTemplate[] = [
  { key: "landing", label: "אתר תדמית / דף נחיתה", sections: [PERSONAL, DISCOVERY, BASIC, LANDING_EXT] },
  { key: "store", label: "אתר חנות", sections: [PERSONAL, DISCOVERY, BASIC, STORE_EXT] },
  { key: "system", label: "מערכת / אפליקציה מורכבת", sections: [PERSONAL, DISCOVERY, BASIC, SYSTEM_EXT] },
  { key: "general", label: "כללי / אחר", sections: [PERSONAL, DISCOVERY, BASIC] },
];

export function templateByKey(key: string): DiscoveryTemplate {
  return DISCOVERY_TEMPLATES.find((t) => t.key === key) ?? DISCOVERY_TEMPLATES[0];
}

/** Flat id → question text, for rendering a saved answer without its section. */
export function questionText(templateKey: string, id: string): string {
  for (const s of templateByKey(templateKey).sections) {
    const q = s.questions.find((x) => x.id === id);
    if (q) return q.q;
  }
  return id;
}

export interface AnswerGroup {
  key: string;
  title: string;
  items: { id: string; q: string; value: string }[];
}

/**
 * Group a flat `{ qid: value }` map (e.g. the shown answers from the public RPC)
 * into the template's sections, in section + question order, so the summary reads
 * like the stages of the call instead of an arbitrary jumble. Unknown ids (legacy)
 * are collected into a trailing "נוסף" group.
 */
export function groupAnswers(templateKey: string, answers: Record<string, string>): AnswerGroup[] {
  const tpl = templateByKey(templateKey);
  const out: AnswerGroup[] = [];
  const known = new Set<string>();
  for (const sec of tpl.sections) {
    const items: AnswerGroup["items"] = [];
    for (const q of sec.questions) {
      known.add(q.id);
      const value = (answers[q.id] ?? "").trim();
      if (value) items.push({ id: q.id, q: q.q, value });
    }
    if (items.length) out.push({ key: sec.key, title: sec.title, items });
  }
  const extras = Object.entries(answers).filter(
    ([id, v]) => !known.has(id) && (v ?? "").trim() !== ""
  );
  if (extras.length) {
    out.push({
      key: "extra",
      title: "נוסף",
      items: extras.map(([id, value]) => ({ id, q: id, value: value.trim() })),
    });
  }
  return out;
}
