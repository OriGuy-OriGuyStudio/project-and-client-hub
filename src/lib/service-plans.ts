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
    label: "יסוד",
    tagline: "שקט ואתר תקין ומאובטח",
    price: 450,
    responseHours: 48,
    hours: 0,
  },
  pro: {
    name: "Studio Pro",
    label: "ביצוע פרימיום",
    tagline: "השותף הטכנולוגי שלך",
    price: 800,
    responseHours: 24,
    hours: 3,
  },
  ultra: {
    name: "Studio Ultra VIP",
    label: "השותף הטכנולוגי",
    tagline: "ליווי צמוד ופיתוח שוטף",
    price: 1950,
    responseHours: 4,
    hours: 7,
  },
};

/** The feature checklist shown on a client's plan card, by tier + site type. */
export function tierFeatures(tier: ServiceTier, siteType: ServiceSiteType): string[] {
  const wp = siteType === "wordpress";
  const base = wp
    ? [
        "אחסון פרימיום, עדכונים וגיבויים בטוחים",
        `חבילת רישיונות בשווי ₪${WP_LICENSE_VALUE.toLocaleString("he-IL")} (Elementor Pro, Crocoblock)`,
        "הגנה היקפית וגיבויים אוטומטיים",
        "דו״ח פעילות וביצועים חודשי",
      ]
    : [
        "אחסון edge ופריסה אוטומטית מ-Git",
        "SSL, גיבויי קוד ומסד נתונים",
        "רשת CDN גלובלית ומהירה",
        "דו״ח פעילות וביצועים חודשי",
      ];

  const pro = wp
    ? [
        "מאיץ מהירות Cloudflare Enterprise",
        "הגנת Malware וסריקות בזמן אמת",
        "בדיקת ביצועים ומהירות חודשית",
      ]
    : [
        "מאיץ מהירות ו-CDN מתקדם (Cloudflare)",
        "סריקת חולשות אבטחה ב-dependencies",
        "בדיקת ביצועים ומהירות חודשית",
      ];

  const ultra = ["משאבי שרת ייעודיים", "חשיבה אסטרטגית רבעונית"];

  const list = [...base];
  if (tier === "pro" || tier === "ultra") list.push(...pro);
  if (tier === "ultra") list.push(...ultra);

  const hours = TIER_META[tier].hours;
  if (hours > 0) list.push(`עד ${hours} שעות עבודה / ייעוץ בחודש`);
  list.push(`עדיפות, תגובה עד ${TIER_META[tier].responseHours} שעות`);
  return list;
}

/** Rough "infrastructure value" line for the ROI note. */
export function infraValue(siteType: ServiceSiteType): string {
  return siteType === "wordpress"
    ? `הרישיונות והתשתית לבדם שווים מעל ₪1,400 בחודש`
    : `האחסון, ה-CDN וזמן הפיתוח השוטף שווים הרבה יותר`;
}
