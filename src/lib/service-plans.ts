// Service & maintenance plan content (fixed, from the studio's pricing doc).
// The client's *assignment* (which tier / site type) lives in project_service.

export type ServiceTier = "core" | "pro" | "ultra";
export type ServiceSiteType = "wordpress" | "custom";

export const TIER_ORDER: ServiceTier[] = ["core", "pro", "ultra"];

/** Value of the bundled WordPress licenses (Elementor Pro + Crocoblock), ₪/mo. */
export const WP_LICENSE_VALUE = 1172;

export const TIER_META: Record<
  ServiceTier,
  { name: string; label: string; tagline: string; price: number; responseHours: number; hours: number }
> = {
  core: {
    name: "Studio Core",
    label: "שקט נפשי",
    tagline: "שקט ואתר תקין ומאובטח",
    price: 450,
    responseHours: 48,
    hours: 0,
  },
  pro: {
    name: "Studio Pro",
    label: "השותף הטכני שלך",
    tagline: "השותף הטכני שלך",
    price: 800,
    responseHours: 24,
    hours: 3,
  },
  ultra: {
    name: "Studio Ultra VIP",
    label: "ה-CTO האישי שלך",
    tagline: "ה-CTO האישי שלך",
    price: 1500,
    responseHours: 4,
    hours: 7,
  },
};

/** The descriptive feature list per tier + site type (what the plans editor
 * stores and edits). The hours/response lines are NOT here, they are appended
 * from the numbers by appendDerived() / tierFeatures(). */
export function baseFeatures(tier: ServiceTier, siteType: ServiceSiteType): string[] {
  const wp = siteType === "wordpress";
  // Core: managed infrastructure, a safety net, passive protection, reporting.
  const base = [
    "כל התשתית מנוהלת: שרת, אחסון וחידושים",
    wp
      ? `רישיונות עיצוב כלולים: Elementor Pro + Crocoblock (שווי מעל ₪${WP_LICENSE_VALUE.toLocaleString("he-IL")} בשנה)`
      : "SSL, גיבויי קוד ומסד נתונים",
    "CDN גלובלי מהיר של Cloudflare, לטעינה מהירה מכל מקום בעולם",
    "גיבויים אוטומטיים יומיים, עם רשת ביטחון: גרסה שמורה מוצגת גם אם השרת נופל לרגע",
    "הגנה אוטומטית מפני בוטים זדוניים, ברקע",
    "לוח ביצועים וזמינות (Uptime) בזמן אמת, ודו״ח פעילות חודשי",
  ];

  // Pro: active, targeted protection + performance (site-type aware).
  const pro = [
    "מאיץ מהירות ו-CDN מתקדם",
    wp
      ? "הגנת נוזקות וסריקות בזמן אמת, כולל בדיקת שלמות קבצים"
      : "סריקת חולשות אבטחה בכל ה-dependencies",
    "הגנת ספאם על הטפסים, בלי תיבות אימות מעצבנות",
    ...(wp ? ["הגנה על עמוד ניהול האתר מפני ניסיונות פריצה"] : []),
    ...(wp ? ["תמונות מומרות ומואצות אוטומטית בהעלאה"] : []),
    "לוח ניטור אבטחה ותעבורה בזמן אמת: חסימות בוטים, איומים שנחסמו ותנועת האתר",
  ];

  // Ultra: dedicated resources, redundancy, priority, strategy.
  const ultra = [
    "משאבי שרת ייעודיים, בלי לחלוק תשתית",
    "גיבוי כפול, במיקום נפרד לגמרי מהאחסון הראשי",
    "קדימות בתור על פני עבודות חדשות",
    "פגישת חשיבה אסטרטגית רבעונית",
  ];

  const list = [...base];
  if (tier === "pro" || tier === "ultra") list.push(...pro);
  if (tier === "ultra") list.push(...ultra);
  return list;
}

/** Append the derived hours + response lines (from the numbers) to a feature
 * list. Shared so DB-driven and code-default lists render identically. */
export function appendDerived(features: string[], hours: number, responseHours: number): string[] {
  const list = [...features];
  if (hours > 0) list.push(`עד ${hours} שעות עבודה / ייעוץ בחודש`);
  list.push(`עדיפות, תגובה עד ${responseHours} שעות`);
  return list;
}

/** The full feature checklist (descriptive + derived) shown on a plan card. */
export function tierFeatures(tier: ServiceTier, siteType: ServiceSiteType): string[] {
  const meta = TIER_META[tier];
  return appendDerived(baseFeatures(tier, siteType), meta.hours, meta.responseHours);
}

/** Rough monthly infra value (hosting + CDN + monitoring), ₪. */
export function infraMonthly(siteType: ServiceSiteType): number {
  return siteType === "wordpress" ? 120 : 90;
}

/** Honest package value breakdown shown to the client (₪/month). */
export function packageValue(tier: ServiceTier, siteType: ServiceSiteType, hourlyRate: number | null) {
  const hours = TIER_META[tier].hours;
  const rate = hourlyRate ?? 0;
  const workValue = Math.round(hours * rate);
  const infra = infraMonthly(siteType);
  const licenseAnnual = siteType === "wordpress" ? WP_LICENSE_VALUE : 0;
  const licenseMonthly = Math.round(licenseAnnual / 12);
  return {
    hours,
    workValue, // 0 if no rate set
    infra,
    licenseAnnual,
    licenseMonthly,
    total: workValue + infra + licenseMonthly,
  };
}
