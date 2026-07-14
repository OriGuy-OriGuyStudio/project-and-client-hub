import type { ServiceTier } from "@/lib/service-plans";

export type QuoteSiteType = "landing" | "portfolio" | "store" | "app" | "custom";
export const QUOTE_MULTS = [1, 1.5, 2] as const;

/** One priced line (page or feature): price = base × mult. */
export type QuoteLine = { id: string; name: string; mult: number };
/** A fixed-price add-on the client can toggle on the quote page. */
export type QuoteUpsell = { id: string; title: string; desc?: string; price: number };

/** A project stage on the timeline. `duration` is soft free text ("כשבוע") or empty. */
export type QuotePhase = { id: string; name: string; desc?: string; duration?: string };
/** A free bonus in the value-stack. `value` (₪) is the anchor, never charged. */
export type QuoteBonus = { id: string; name: string; desc?: string; value: number };
/** A "why me" differentiator card. */
export type QuoteDiff = { id: string; title: string; desc?: string };
/** One "what happens next" step. */
export type QuoteStep = { id: string; text: string };
/** One FAQ entry (objection handling). */
export type QuoteFaq = { id: string; q: string; a: string };
/** Payment split: a deposit on approval, the rest before launch. */
export type QuotePayment = { deposit_pct: number; terms?: string };
/** A custom discount on the project total, by fixed amount (₪) or percentage. */
export type QuoteDiscount = { mode: "amount" | "percent"; value: number; label?: string };
/** A client testimonial shown on the quote page (trust). */
export type QuoteTestimonial = { quote: string; name: string; role?: string };

/** The full quote structure (source of truth for all pricing + copy). Stored as
 *  the `content` jsonb of a price_quotes row. New quotes are seeded from
 *  quote_defaults (see newQuoteContent) so every quote is born complete. */
export type QuoteContent = {
  base_project: number;
  base_page: number;
  base_feature: number;
  margin_pct: number; // 10 | 20 | 30
  pages: QuoteLine[];
  features: QuoteLine[];
  upsells: QuoteUpsell[];
  maintenance: { offer: boolean; tiers: ServiceTier[] };
  vat_pct: number; // default 18
  intro?: string; // client-facing narrative ("קצת על הפרויקט")
  notes?: string; // internal only (stripped from the public RPC)
  // --- premium sections (seeded from quote_defaults, editable per quote) ---
  differentiators?: QuoteDiff[]; // "למה אני"
  phases?: QuotePhase[]; // "שלבים ולו״ז"
  bonuses?: QuoteBonus[]; // "בונוסים במתנה" (value-stack)
  next_steps?: QuoteStep[]; // "מה קורה אחרי שתחתום"
  faq?: QuoteFaq[]; // "שאלות נפוצות"
  legal?: string[]; // "סעיפים משפטיים"
  payment?: QuotePayment; // deposit split
  discount?: QuoteDiscount | null; // custom discount on the total
  testimonial?: QuoteTestimonial | null; // trust quote
  validity_days?: number; // quote valid for N days from send
  version?: string; // "v1.0"
};

/** Studio-wide boilerplate that seeds every new quote. One row, admin-edited at
 *  /admin/tools/quote/defaults. */
export type QuoteDefaults = {
  differentiators: QuoteDiff[];
  phases: QuotePhase[];
  bonuses: QuoteBonus[];
  next_steps: QuoteStep[];
  faq: QuoteFaq[];
  legal: string[];
  payment: QuotePayment;
  validity_days: number;
};

/** What the client picked on the quote page. */
export type QuoteSelected = { upsell_ids: string[]; maintenance_tier: ServiceTier | null };

export const SITE_TYPE_LABEL: Record<QuoteSiteType, string> = {
  landing: "דף נחיתה",
  portfolio: "אתר תדמית",
  store: "חנות / קטלוג",
  app: "אפליקציה",
  custom: "פרויקט מותאם אישית",
};

export function emptyQuoteContent(): QuoteContent {
  return {
    base_project: 1500,
    base_page: 850,
    base_feature: 650,
    margin_pct: 30,
    pages: [],
    features: [],
    upsells: [],
    maintenance: { offer: true, tiers: ["core", "pro", "ultra"] },
    vat_pct: 18,
    intro: "",
    notes: "",
    discount: null,
    differentiators: [],
    phases: [],
    bonuses: [],
    next_steps: [],
    faq: [],
    legal: [],
    payment: { deposit_pct: 50 },
    validity_days: 7,
    version: "v1.0",
  };
}

let _seq = 0;
/** A stable-ish id for a new list row (crypto.randomUUID when available). */
export function newId(prefix = "q"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

/** Fallback boilerplate used when no quote_defaults row exists yet. */
export function fallbackQuoteDefaults(): QuoteDefaults {
  return {
    differentiators: [
      { id: newId(), title: "קוד מותאם אישית, בלי תבניות", desc: "אני כותב את האתר בהתאמה מלאה, כדי שיהיה מהיר, מאובטח ומדויק לעסק שלך, בלי תוספים מיותרים שמכבידים." },
      { id: newId(), title: "פרימיום שמרגיש אחרת", desc: "עיצוב, אנימציות ומיקרו-אינטראקציות שנותנים לאתר תחושת חיים ויוקרה, ומבדלים אותך מהשוק." },
      { id: newId(), title: "ליווי אישי לאורך כל הדרך", desc: "אתה מקבל אותי ישירות, לא סוכנות. תקשורת רציפה, פורטל מעקב, וזמינות אמיתית." },
    ],
    phases: [
      { id: newId(), name: "אפיון", desc: "שאלון, מפת אתר, תכנון עמודים ושרטוטי וויירפריים.", duration: "" },
      { id: newId(), name: "עיצוב", desc: "גיבוש שפה ויזואלית, פלטה ופונטים, ועיצוב כל המסכים.", duration: "" },
      { id: newId(), name: "פיתוח", desc: "בניית כל הדפים, רספונסיביות מלאה ואינטראקציות.", duration: "" },
      { id: newId(), name: "QA ועלייה לאוויר", desc: "בדיקות איכות, אופטימיזציית מהירות והשקה.", duration: "" },
    ],
    bonuses: [
      { id: newId(), name: "גישה למערכת Orion למעקב הפרויקט", desc: "פורטל ניהול הפרויקט שלי, לעקוב אחרי כל שלב בראש שקט וליצור איתי קשר.", value: 600 },
      { id: newId(), name: "אופטימיזציית מהירות", desc: "שיפור זמני טעינה לציון גבוה ב-PageSpeed.", value: 800 },
      { id: newId(), name: "הגדרת Google Analytics ו-Search Console", desc: "התקנה וחיבור מלא של כלי המדידה.", value: 400 },
      { id: newId(), name: "גיבוי ענן ראשוני", desc: "גיבוי מלא של האתר אחרי ההשקה.", value: 350 },
      { id: newId(), name: "30 ימי תמיכה אחרי ההשקה", desc: "מענה לשאלות ותיקוני באגים קלים ללא עלות.", value: 900 },
    ],
    next_steps: [
      { id: newId(), text: "אישור וחתימה על ההצעה כאן בעמוד" },
      { id: newId(), text: "תשלום מקדמה לשריון מקום ביומן" },
      { id: newId(), text: "שיחת התנעה ואיסוף חומרים" },
      { id: newId(), text: "מתחילים לעבוד, ואתה עוקב בפורטל" },
    ],
    faq: [
      { id: newId(), q: "כמה סבבי תיקונים כלולים?", a: "כלולים שני סבבי תיקונים מרוכזים בכל שלב. תיקונים מעבר לכך מתומחרים בנפרד ובשקיפות מלאה מראש." },
      { id: newId(), q: "מה קורה אחרי שהאתר עולה לאוויר?", a: "מקבל 30 ימי תמיכה חינם, ואפשר להמשיך עם חבילת תחזוקה חודשית לשקט נפשי לאורך זמן." },
      { id: newId(), q: "האתר בבעלותי המלאה?", a: "בהחלט. בסיום הפרויקט האתר והקוד עוברים אליך לחלוטין." },
      { id: newId(), q: "כמה זמן לוקח הפרויקט?", a: "תלוי בהיקף, ונקבע יחד בשיחת ההתנעה. אני מקפיד על לו״ז ברור ועדכונים שוטפים בפורטל." },
    ],
    legal: [
      "העבודה תבוצע על הצד הטוב ביותר לפי שיקול דעת מקצועי ובהתאם למוסכם בשיחת האפיון.",
      "סבב תיקונים משמעו מסמך מרוכז של כל הבקשות. תיקונים מעבר לסבבים המוסכמים יתומחרו בנפרד.",
      "העלאת האתר לאוויר תתבצע רק לאחר העברת התשלום המלא.",
      "לקוח שאינו מספק תכנים עד למועד המוסכם, האתר יועלה עם תכנים לדוגמה והחיוב ייגבה במועד.",
      "האחריות המשפטית לנגישות, זכויות יוצרים ותוכן האתר חלה על הלקוח. יותקן תוסף נגישות ותינתן הדרכה.",
      "לסטודיו שמורה הזכות להציג את הפרויקט בפורטפוליו ולהופיע בקרדיט בתחתית האתר.",
      "הצעת המחיר בש״ח. אישורה על ידי הלקוח מהווה אישור רשמי בכתב בעל תוקף.",
    ],
    payment: { deposit_pct: 50, terms: "מקדמה לאישור ההצעה, והיתרה לפני העלייה לאוויר." },
    validity_days: 7,
  };
}

/** Build the content of a brand-new quote by merging the studio defaults into a
 *  blank content shell. */
export function newQuoteContent(defaults?: QuoteDefaults | null): QuoteContent {
  const base = emptyQuoteContent();
  const d = defaults ?? fallbackQuoteDefaults();
  return {
    ...base,
    differentiators: d.differentiators ?? [],
    phases: d.phases ?? [],
    bonuses: d.bonuses ?? [],
    next_steps: d.next_steps ?? [],
    faq: d.faq ?? [],
    legal: d.legal ?? [],
    payment: d.payment ?? base.payment,
    validity_days: d.validity_days ?? base.validity_days,
  };
}

/** Total ₪ value of the free bonuses (the value-stack anchor). */
export function bonusesTotal(c: QuoteContent): number {
  return (c.bonuses ?? []).reduce((n, b) => n + (Number(b.value) || 0), 0);
}

/** Split a total into a deposit + remainder by the quote's deposit percentage. */
export function paymentSplit(total: number, c: QuoteContent): { deposit: number; rest: number; depositPct: number } {
  const pct = Math.min(100, Math.max(0, c.payment?.deposit_pct ?? 50));
  const deposit = Math.round((total * pct) / 100);
  return { deposit, rest: Math.max(0, total - deposit), depositPct: pct };
}

export function linePrice(base: number, mult: number): number {
  return Math.round((base || 0) * (mult || 1));
}

export function withVat(amount: number, vatPct: number): number {
  return Math.round(amount * (1 + (vatPct || 0) / 100));
}

export type QuoteTotals = {
  pagesTotal: number;
  featuresTotal: number;
  subtotal: number;
  margin: number;
  oneTimeBase: number; // subtotal + margin, before upsells
  upsellsTotal: number;
  oneTimeTotal: number; // oneTimeBase + selected upsells (before discount)
  discountAmount: number; // resolved discount in ₪ (0 if none)
  netTotal: number; // oneTimeTotal - discount, ex VAT (what VAT is applied to)
  monthly: number; // selected maintenance tier price / month (0 if none)
};

/** Resolve a discount to a ₪ amount against a pre-discount total. */
export function discountAmountFor(total: number, d?: QuoteDiscount | null): number {
  if (!d || !d.value) return 0;
  const raw = d.mode === "percent" ? (total * Math.min(100, Math.max(0, d.value))) / 100 : d.value;
  return Math.min(total, Math.max(0, Math.round(raw)));
}

/**
 * Compute all quote totals from the content + (optional) client selections.
 * `monthlyForTier` maps a maintenance tier to its ₪/month price (from
 * service_plan_content / plan-config), so the lib stays free of that dependency.
 */
export function computeQuote(
  c: QuoteContent,
  selected?: QuoteSelected | null,
  monthlyForTier?: (tier: ServiceTier) => number
): QuoteTotals {
  const pagesTotal = (c.pages ?? []).reduce((n, p) => n + linePrice(c.base_page, p.mult), 0);
  const featuresTotal = (c.features ?? []).reduce((n, f) => n + linePrice(c.base_feature, f.mult), 0);
  const subtotal = (c.base_project || 0) + pagesTotal + featuresTotal;
  const margin = Math.round(subtotal * (c.margin_pct || 0) / 100);
  const oneTimeBase = subtotal + margin;

  const chosenIds = new Set(selected?.upsell_ids ?? []);
  const upsellsTotal = (c.upsells ?? [])
    .filter((u) => chosenIds.has(u.id))
    .reduce((n, u) => n + (u.price || 0), 0);

  const tier = selected?.maintenance_tier ?? null;
  const monthly = tier && monthlyForTier ? monthlyForTier(tier) : 0;

  const oneTimeTotal = oneTimeBase + upsellsTotal;
  const discountAmount = discountAmountFor(oneTimeTotal, c.discount);

  return {
    pagesTotal,
    featuresTotal,
    subtotal,
    margin,
    oneTimeBase,
    upsellsTotal,
    oneTimeTotal,
    discountAmount,
    netTotal: Math.max(0, oneTimeTotal - discountAmount),
    monthly,
  };
}

export function shekel(n: number): string {
  return "₪" + Math.round(n || 0).toLocaleString("he-IL");
}
