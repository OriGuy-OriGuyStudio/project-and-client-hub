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

/** My discovery-call additions — the "get to know the project" part. */
const DISCOVERY: DiscoverySection = {
  key: "discovery",
  title: "שיחת היכרות",
  questions: [
    {
      id: "disc_budget",
      q: "תקציב משוער לפרויקט?",
      hint: "טווח גס מספיק",
      chips: ["עד 10,000 ₪", "10,000–20,000 ₪", "20,000–40,000 ₪", "40,000 ₪ ומעלה", "טרם הוגדר"],
    },
    {
      id: "disc_timeline",
      q: "לוח זמנים / דדליין?",
      hint: "יש תאריך יעד או אירוע?",
      chips: ["דחוף (עד חודש)", "1–2 חודשים", "2–4 חודשים", "גמיש", "לפני אירוע / תאריך יעד"],
    },
    { id: "disc_decision", q: "מי מקבל ההחלטות מצד הלקוח?", hint: "איש קשר + מי מאשר" },
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
    },
    {
      id: "basic_today",
      q: "מה יש לך כיום?",
      hint: "איך מגיעים לקוחות? יש אתר נוכחי? איך העסק רץ עד היום ומה צריך לשפר?",
    },
    {
      id: "basic_future",
      q: "מי תהיה עוד חמש שנים?",
      hint: "לאן אתה רוצה להגיע? איזו תדמית עתידית נראה באתר כדי לקחת אותך לשם הכי מהר?",
    },
  ],
};

/** Extra for brochure / landing sites. */
const LEGAL_CHIPS = ["נדרש תקנון + הצהרת נגישות", "הצהרת נגישות בלבד", "אין צורך כרגע"];

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
    { id: "land_legal", q: "תקנון / תנאי שימוש / נגישות?", chips: LEGAL_CHIPS },
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
    { id: "store_legal", q: "תקנון / תנאי שימוש / נגישות?", chips: LEGAL_CHIPS },
  ],
};

export interface DiscoveryTemplate {
  key: string;
  label: string;
  sections: DiscoverySection[];
}

export const DISCOVERY_TEMPLATES: DiscoveryTemplate[] = [
  { key: "landing", label: "אתר תדמית / דף נחיתה", sections: [DISCOVERY, BASIC, LANDING_EXT] },
  { key: "store", label: "אתר חנות", sections: [DISCOVERY, BASIC, STORE_EXT] },
  { key: "general", label: "כללי / אחר", sections: [DISCOVERY, BASIC] },
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
