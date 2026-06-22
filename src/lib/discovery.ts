// Fixed questionnaire templates for the discovery / characterization call.
// The questions live in code (they're standard for the studio); each session
// only stores the answers keyed by question id.

export interface DiscoveryQuestion {
  id: string;
  q: string;
  hint?: string;
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
    { id: "disc_budget", q: "תקציב משוער לפרויקט?", hint: "טווח גס מספיק" },
    { id: "disc_timeline", q: "לוח זמנים / דדליין?", hint: "יש תאריך יעד או אירוע?" },
    { id: "disc_decision", q: "מי מקבל ההחלטות מצד הלקוח?", hint: "איש קשר + מי מאשר" },
    { id: "disc_competitors", q: "מתחרים עיקריים ואתרים שאהבת", hint: "קישורים + מה אהבת בכל אחד" },
    { id: "disc_kpi", q: "איך נמדדת הצלחה?", hint: "לידים / מכירות / חשיפה / הרשמות" },
    { id: "disc_assets", q: "אילו חומרים כבר קיימים?", hint: "לוגו, מיתוג, תמונות, טקסטים, סרטונים" },
    { id: "disc_marketing", q: "ערוצי שיווק נוכחיים", hint: "אורגני / ממומן / רשתות / דיוור" },
    { id: "disc_style", q: "העדפות עיצוביות וטון", hint: "סגנון, צבעים, רפרנסים, שפה" },
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
const LANDING_EXT: DiscoverySection = {
  key: "landing_ext",
  title: "אפיון מורחב — תדמית / נחיתה",
  questions: [
    { id: "land_content_supply", q: "מי יספק את התכנים?", hint: "תמונות / סרטונים / מסמכים / תוכן כתוב" },
    { id: "land_content_input", q: "מי יזין את התכנים לאתר?" },
    { id: "land_thirdparty", q: "צורך בממשק למערכת צד ג'?", hint: "מערכת דיוור / CRM / יומן / ניוזלטר" },
    { id: "land_legal", q: "תקנון / תנאי שימוש / נגישות?" },
  ],
};

/** Extra for e-commerce sites. */
const STORE_EXT: DiscoverySection = {
  key: "store_ext",
  title: "אפיון מורחב — חנות",
  questions: [
    { id: "store_payment", q: "ספק סליקה נוכחי לעסק?" },
    { id: "store_inventory", q: "מערכת מלאי / קופות / צורך באינטגרציה?" },
    { id: "store_catalog", q: "סדר המוצרים ושיטת ההעלאה?", hint: "מי מעלה את המוצרים?" },
    { id: "store_shipping", q: "אפשרויות המשלוח?" },
    { id: "store_legal", q: "תקנון / תנאי שימוש / נגישות?" },
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
