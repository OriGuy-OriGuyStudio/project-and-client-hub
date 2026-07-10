// Legal terms for the maintenance-packages landing, kept in ONE versioned place
// so the page renders the same text that gets frozen into a saved agreement.
// When a client approves, buildTermsSnapshot() copies everything below into an
// immutable JSON snapshot on service_agreements, so future edits here never
// change what an earlier client agreed to. Bump AGREEMENT_VERSION on any change.

import { TIER_META, tierFeatures, type ServiceTier, type ServiceSiteType } from "./service-plans";
import { applyGender } from "./gender";
import type { Gender } from "@/types/database";

export const AGREEMENT_VERSION = "2026-07-10";

/** Annual (yearly) billing discount, in percent. */
export const ANNUAL_DISCOUNT_PCT = 15;

/** Yearly total for a given monthly price, after the annual discount. */
export function annualTotal(monthly: number): number {
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100));
}
/** Effective monthly price under annual billing. */
export function annualMonthly(monthly: number): number {
  return Math.round(monthly * (1 - ANNUAL_DISCOUNT_PCT / 100));
}

export const TERMS_BLOCKS: { title: string; items: string[] }[] = [
  {
    title: "תנאי תשלום ו״האותיות הקטנות״",
    items: [
      "שיטת התשלום: כרטיס אשראי, חיוב חודשי מחזורי (ריטיינר).",
      "מועד החיוב: בכל 1 לחודש עבור החודש הקרוב.",
      "הפסקת השירות: בכל עת, בהודעה של 30 יום מראש בכתב.",
      "עלויות צד ג׳: אחסון ורישיונות כלולים; דומיין ושירותים חיצוניים על הלקוח.",
      "אחריות: הסטודיו אינו אחראי לתכני הלקוח או לנזק מהתערבות חיצונית בקוד.",
    ],
  },
  {
    title: "נספחים והגבלות אחריות",
    items: [
      "רישיונות: בתוקף כל עוד החבילה פעילה; בסיום, רכישה עצמאית באחריות הלקוח.",
      "זמני תגובה: יעד שירות, לא ערבות לתיקון, ולא חלים על תקלות בשליטת צד ג׳.",
      "היקף: תחזוקה, אבטחה, ביצועים ותיקונים. פיתוח או עיצוב מחדש בתמחור נפרד.",
      "דין: הדין הישראלי, סמכות בישראל.",
    ],
  },
];

/** The usage-approval paragraph (gendered), naming the chosen package. */
export function usageApproval(tierName: string, gender: Gender): string {
  return applyGender(
    `אני {מאשר|מאשרת} שקראתי והבנתי את תנאי החבילה הנבחרת (${tierName}), לרבות תנאי התשלום והנספחים, ו{מסכים|מסכימה} להם. אישור זה מהווה הזמנת שירות בלבד ואינו כולל תשלום בשלב זה; החיוב יתואם בנפרד.`,
    gender,
  );
}

/** The consent-checkbox line (gendered). Kept in sync with the rendered label
 * on the landing (which shows "מדיניות הפרטיות" as a link to /privacy). */
export function consentText(gender: Gender): string {
  return applyGender(
    "קראתי ואני {מאשר|מאשרת} את תנאי התשלום, הנספחים, מסמך אישור השימוש ומדיניות הפרטיות.",
    gender,
  );
}

export interface TermsSnapshot {
  version: string;
  tier: ServiceTier;
  tier_name: string;
  site_type: ServiceSiteType;
  site_type_label: string;
  price: number;
  response_hours: number;
  work_hours: number;
  features: string[];
  blocks: { title: string; items: string[] }[];
  usage_approval: string;
  consent_text: string;
  annual_discount_pct: number;
}

/** Freeze everything the client saw + agreed to, for the saved agreement. */
export function buildTermsSnapshot(
  tier: ServiceTier,
  siteType: ServiceSiteType,
  gender: Gender,
): TermsSnapshot {
  const meta = TIER_META[tier];
  return {
    version: AGREEMENT_VERSION,
    tier,
    tier_name: meta.name,
    site_type: siteType,
    site_type_label: siteType === "wordpress" ? "אתר WordPress" : "אתר מותאם אישית (קוד)",
    price: meta.price,
    response_hours: meta.responseHours,
    work_hours: meta.hours,
    features: tierFeatures(tier, siteType),
    blocks: TERMS_BLOCKS,
    usage_approval: usageApproval(meta.name, gender),
    consent_text: consentText(gender),
    annual_discount_pct: ANNUAL_DISCOUNT_PCT,
  };
}
