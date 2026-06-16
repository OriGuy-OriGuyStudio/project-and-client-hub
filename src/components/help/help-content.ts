/**
 * Single source of truth for the in-app help & onboarding.
 *
 * ⚠️ When a feature is added / changed / removed, update THIS file - the help
 * panel (sections + FAQ) and the onboarding tour both read from here, so the
 * learning material stays in sync with the product.
 */

export interface HelpSection {
  title: string;
  body: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface TourStep {
  /** CSS selector of the element to highlight (data-tour="..."). */
  selector: string;
  title: string;
  description: string;
}

/**
 * A "what's new" entry shown to RETURNING users (a text modal), versus the full
 * driver.js tour shown to brand-new users. When you add/change client or partner
 * UI: add an entry here with the next `version` number AND (for new users) update
 * the matching tour step / data-tour. See [[onboarding-tour-on-ui-changes]] memory.
 */
export interface WhatsNewEntry {
  version: number;
  title: string;
  items: string[];
}

/** What each part of the client portal does. */
export const helpSections: HelpSection[] = [
  {
    title: "לוח בקרה",
    body: "המסך הראשי - כל הפרויקטים שלך במבט אחד. לחיצה על פרויקט פותחת את עמוד הפרויקט המלא.",
  },
  {
    title: "ציר התקדמות",
    body: "השלבים של הפרויקט מחולקים למקטעים (אפיון, עיצוב, פיתוח ועוד), כל מקטע עם תת-המשימות שלו והסטטוס שלהן - כך תמיד רואים איפה הדברים עומדים.",
  },
  {
    title: "אישור עבודה",
    body: "כשמשהו מוכן לבדיקתך, הוא יופיע כאן. אפשר לאשר בלחיצה, או לשלוח הערות אם צריך תיקונים.",
  },
  {
    title: "חומרים דרושים",
    body: "רשימת החומרים שהסטודיו צריך ממך (לוגו, תמונות, טקסטים). סמן מה שכבר שלחת.",
  },
  {
    title: "קבצים ומסמכים",
    body: "כל קבצי הפרויקט להורדה, מסודרים בתיקיות, ומסמכי תוכן שהסטודיו שיתף.",
  },
  {
    title: "תשלומים",
    body: "התשלומים של הפרויקט, הסכומים והסטטוס שלהם, וקישור מהיר לתשלום כשצריך.",
  },
  {
    title: "צ'אט ויצירת קשר",
    body: "תקשורת ישירה עם הסטודיו בתוך הפרויקט, או דרך כפתור 'דברו איתי' בוואטסאפ.",
  },
  {
    title: "אחריות",
    body: "תקופת האחריות על הפרויקט והזמן שנותר עד סיומה.",
  },
  {
    title: "תוכנית שותפים",
    body: "אם הופעלה עבורך - אפשר להפנות לקוחות, לצבור קרדיטים ולממש פרסים.",
  },
  {
    title: "פרופיל",
    body: "הפרטים האישיים שלך, וגם מקום לשלוח לי הערות לשיפור הממשק.",
  },
];

/** Common questions. */
export const faq: FaqItem[] = [
  {
    q: "איך מאשרים עבודה?",
    a: "בעמוד הפרויקט, בסעיף 'אישור עבודה', לוחצים 'אישרתי' - או 'יש לי הערות' כדי לבקש תיקונים.",
  },
  {
    q: "איפה מורידים את הקבצים?",
    a: "בסעיף 'קבצים' בעמוד הפרויקט. אפשר להוריד קובץ בודד או את הכל כ-ZIP.",
  },
  {
    q: "מתי ואיך משלמים?",
    a: "בסעיף 'תשלומים' תראה את התשלומים והסטטוס. כשיש קישור לתשלום, לוחצים עליו ומשלמים ישירות.",
  },
  {
    q: "איך יוצרים קשר עם הסטודיו?",
    a: "דרך הצ'אט הפנימי בעמוד הפרויקט, או כפתור 'דברו איתי' בוואטסאפ בלוח הבקרה.",
  },
  {
    q: "אפשר להפעיל את ההדרכה שוב?",
    a: "כן - בכל רגע, דרך כפתור 'התחל הדרכה' כאן בחלון העזרה.",
  },
];

/** First-login orientation tour (runs on the client dashboard). */
export const clientTourSteps: TourStep[] = [
  {
    selector: '[data-tour="nav"]',
    title: "תפריט הניווט",
    description: "מכאן מנווטים בין החלקים של המערכת - לוח הבקרה, הפרויקטים והפרופיל.",
  },
  {
    selector: '[data-tour="projects"]',
    title: "הפרויקטים שלך",
    description: "כאן מופיעים כל הפרויקטים. לחיצה על פרויקט פותחת את העמוד המלא שלו - ציר התקדמות, אישורים, קבצים, צ'אט ועוד.",
  },
  {
    selector: '[data-tour="contact"]',
    title: "יצירת קשר",
    description: "צריך משהו? כאן אפשר לפנות אליי ישירות בכל שאלה או עדכון.",
  },
  {
    selector: '[data-tour="profile"]',
    title: "הפרטים שלך",
    description: "בעמוד הפרופיל מעדכנים את הפרטים האישיים, ואפשר גם לשלוח לי הערות לשיפור הממשק.",
  },
  {
    selector: '[data-tour="partner"]',
    title: "תוכנית שותפים",
    description:
      "אם הופעלה לך תוכנית השותפים, כאן מפנים לקוחות, צוברים קרדיטים, וממשים פרסים בחנות — לכל פרס יש שווי בש״ח ובר התקדמות.",
  },
  {
    selector: '[data-tour="help"]',
    title: "עזרה בכל רגע",
    description: "כל ההסברים והשאלות הנפוצות תמיד כאן, מאחורי כפתור הסימן שאלה (?) - וגם אפשר להפעיל את ההדרכה הזו שוב.",
  },
];

/** Tour for the client "תוכנית שותפים" / rewards-store page (its own first visit). */
export const clientStoreTourSteps: TourStep[] = [
  {
    selector: '[data-tour="store-credits"]',
    title: "הקרדיטים שלך",
    description:
      "כל הפניה מזכה אותך בקרדיט, ועסקה שנסגרת בעוד 5. את היתרה ממירים בפרסים שבחנות.",
  },
  {
    selector: '[data-tour="store-referral"]',
    title: "הגשת הפניה",
    description:
      "ממלאים שם ופרטי קשר של עסק שיכול להתאים — מקבלים קרדיט מיידי, ועוד קרדיטים כשהעסקה נסגרת.",
  },
  {
    selector: '[data-tour="store-rewards"]',
    title: "חנות הפרסים",
    description:
      "ממירים קרדיטים בפרסים. לכל פרס מוצג השווי בש״ח ובר התקדמות (\"עוד X ואתה משחרר\"), ופרסים מודגשים או מוגבלים בזמן קופצים בראש.",
  },
  {
    selector: '[data-tour="store-referrals"]',
    title: "ההפניות שלך",
    description:
      "כל ההפניות שהגשת, עם הסטטוס של כל אחת. הפניה שעדיין לא טופלה אפשר לערוך או למחוק.",
  },
  {
    selector: '[data-tour="store-history"]',
    title: "היסטוריית הקרדיטים",
    description:
      "ציר זמן של כל תנועות הקרדיטים שלך — הפניות, עסקאות שנסגרו, ומימושים בחנות.",
  },
];

/* ───────────────────────── Partner portal ───────────────────────── */

/** What each part of the partner portal does. */
export const partnerHelpSections: HelpSection[] = [
  {
    title: "לוח בקרה",
    body: "כל מה שחשוב במבט אחד: הלידים שהגשת, העמלות שהתקבלו, יתרת המטבעות והמסלול שלך.",
  },
  {
    title: "הגשת ליד",
    body: "מפנים לקוח חדש דרך הטופס. כל ליד מופיע אצלך עם הסטטוס שלו והעמלה הצפויה.",
  },
  {
    title: "לינק ההפניה האישי",
    body: "לינק אישי לשיתוף. כל כניסה דרכו וכל המרה לליד נספרות אוטומטית.",
  },
  {
    title: "עמלות ומסלולים",
    body: "מתחילים ב-5% ועולים עד 10% ככל שנסגרות יותר עסקאות איכותיות. אחוז המסלול הנוכחי מוצג בלוח הבקרה.",
  },
  {
    title: "מטבעות",
    body: "צוברים 20 מטבעות על כל עסקה שנסגרת. המטבעות נצברים בנפרד מהעמלה הכספית.",
  },
  {
    title: "החנות",
    body: "ממירים מטבעות בפרסים: בוסט עמלה +2%, המרה לתשלום, שוברים, פוסט שיתופי עם קישור לאתר שלך, גישה לפיקסל, ותרומה לצדקה בשמך.",
  },
  {
    title: "חומרי מכירה",
    body: "מצגות, קישורים וטקסטים מוכנים שיעזרו לך להפנות לקוחות.",
  },
  {
    title: "עזרה",
    body: "כפתור הסימן שאלה (?) תמיד כאן, עם ההסברים, השאלות הנפוצות, והאפשרות להפעיל את ההדרכה שוב.",
  },
];

export const partnerFaq: FaqItem[] = [
  {
    q: "איך נצברת העמלה שלי?",
    a: "על כל עסקה שנסגרת אתה מקבל עמלה לפי אחוז המסלול הנוכחי שלך. את הסכומים המאושרים תראה בלוח הבקרה.",
  },
  {
    q: "איך עולים מסלול?",
    a: "המסלול נקבע לפי מספר העסקאות שנסגרו: 5% בהתחלה, ועד 10% במסלול הגבוה. ככל שתפנה יותר פניות איכותיות שנסגרות, האחוז עולה אוטומטית.",
  },
  {
    q: "מה ההבדל בין מטבעות לעמלה?",
    a: "העמלה היא כסף שמגיע לך על עסקאות שנסגרות. המטבעות הן תגמול נוסף (20 לעסקה) שאפשר לממש בחנות, למשל בבוסט עמלה זמני או בהמרה לתשלום.",
  },
  {
    q: "מתי מקבלים את התשלום?",
    a: "אחרי שעסקה נסגרת ואני מאשר את התשלום מולך, הסכום מסומן כשולם ומופיע ב״עמלה שהתקבלה״.",
  },
];

/** First-login orientation tour (runs on the partner dashboard). */
export const partnerTourSteps: TourStep[] = [
  {
    selector: '[data-tour="nav"]',
    title: "תפריט הניווט",
    description: "מכאן מנווטים בין לוח הבקרה, הגשת ליד וחומרי המכירה.",
  },
  {
    selector: '[data-tour="new-lead"]',
    title: "הגשת ליד",
    description: "מפנים לקוח חדש בלחיצה. כל ליד שתפנה יופיע אצלך עם הסטטוס והעמלה הצפויה.",
  },
  {
    selector: '[data-tour="partner-stats"]',
    title: "הנתונים שלך",
    description: "לידים שהוגשו, עסקאות שנסגרו והעמלה שהתקבלה - במבט אחד.",
  },
  {
    selector: '[data-tour="referral-link"]',
    title: "לינק ההפניה",
    description: "הלינק האישי שלך לשיתוף. כל כניסה והמרה דרכו נספרות.",
  },
  {
    selector: '[data-tour="partner-rewards"]',
    title: "מטבעות, מסלול וחנות",
    description:
      "יתרת המטבעות, מסלול העמלה (5%→10%), והחנות שבה ממירים מטבעות בפרסים — לכל פרס שווי בש״ח ובר התקדמות.",
  },
  {
    selector: '[data-tour="help"]',
    title: "עזרה בכל רגע",
    description: "כל ההסברים והשאלות תמיד כאן מאחורי כפתור ה-? - וגם אפשר להפעיל את ההדרכה הזו שוב.",
  },
];

/* ───────── "What's new" for returning users (modal, not the full tour) ───────── */

export const clientWhatsNew: WhatsNewEntry[] = [
  {
    version: 2,
    title: "חנות הפרסים עוצבה מחדש 🎁",
    items: [
      "כל פרס מראה עכשיו את השווי בש״ח",
      'בר התקדמות לכל פרס — "עוד X ואתה משחרר"',
      "פרסים מודגשים ומבצעים מוגבלים בזמן",
    ],
  },
];

export const partnerWhatsNew: WhatsNewEntry[] = [
  {
    version: 2,
    title: "החנות עוצבה מחדש 🎁",
    items: [
      "כל פרס מראה את השווי בש״ח ובר התקדמות",
      "פרסים מודגשים ומבצעים מוגבלים בזמן",
      "תפריט מהיר לקפיצה בין החלקים בעמוד",
    ],
  },
];

/** Current version per audience = the highest "what's new" version. */
export const CLIENT_TOUR_VERSION = Math.max(1, ...clientWhatsNew.map((e) => e.version));
export const PARTNER_TOUR_VERSION = Math.max(1, ...partnerWhatsNew.map((e) => e.version));
