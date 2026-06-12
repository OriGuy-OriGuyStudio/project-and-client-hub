/**
 * Single source of truth for the in-app help & onboarding.
 *
 * ⚠️ When a feature is added / changed / removed, update THIS file — the help
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

/** What each part of the client portal does. */
export const helpSections: HelpSection[] = [
  {
    title: "לוח בקרה",
    body: "המסך הראשי — כל הפרויקטים שלך במבט אחד. לחיצה על פרויקט פותחת את עמוד הפרויקט המלא.",
  },
  {
    title: "ציר התקדמות",
    body: "השלבים של הפרויקט מחולקים למקטעים (אפיון, עיצוב, פיתוח ועוד), כל מקטע עם תת-המשימות שלו והסטטוס שלהן — כך תמיד רואים איפה הדברים עומדים.",
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
    body: "אם הופעלה עבורך — אפשר להפנות לקוחות, לצבור קרדיטים ולממש פרסים.",
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
    a: "בעמוד הפרויקט, בסעיף 'אישור עבודה', לוחצים 'אישרתי' — או 'יש לי הערות' כדי לבקש תיקונים.",
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
    a: "כן — בכל רגע, דרך כפתור 'התחל הדרכה' כאן בחלון העזרה.",
  },
];

/** First-login orientation tour (runs on the client dashboard). */
export const clientTourSteps: TourStep[] = [
  {
    selector: '[data-tour="nav"]',
    title: "תפריט הניווט",
    description: "מכאן מנווטים בין החלקים של המערכת — לוח הבקרה, הפרויקטים והפרופיל.",
  },
  {
    selector: '[data-tour="projects"]',
    title: "הפרויקטים שלך",
    description: "כאן מופיעים כל הפרויקטים. לחיצה על פרויקט פותחת את העמוד המלא שלו — ציר התקדמות, אישורים, קבצים, צ'אט ועוד.",
  },
  {
    selector: '[data-tour="contact"]',
    title: "יצירת קשר",
    description: "צריך משהו? כאן אפשר לפנות אליי ישירות בכל שאלה או עדכון.",
  },
  {
    selector: '[data-tour="help"]',
    title: "עזרה בכל רגע",
    description: "כל ההסברים והשאלות הנפוצות תמיד כאן — וגם אפשר להפעיל את ההדרכה הזו שוב.",
  },
];
