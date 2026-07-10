import { useEffect, useState } from "react";
import { ListChecks, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ServiceTier, ServiceSiteType } from "@/lib/service-plans";

// Operational checklist for onboarding a new maintenance client. The relevant
// steps depend on the package (Core/Pro/Ultra) and the site type (WordPress vs
// custom code), mirroring the internal operational guide. Selection + ticks
// persist in localStorage so a mid-onboarding close keeps the place.
const STORAGE_KEY = "maint-onboarding-checklist-v2";

const TIER_ORDER: ServiceTier[] = ["core", "pro", "ultra"];
const TIER_LABEL: Record<ServiceTier, string> = { core: "Core", pro: "Pro", ultra: "Ultra VIP" };
const SITE_LABEL: Record<ServiceSiteType, string> = { wordpress: "WordPress", custom: "אתר קוד" };

// A step applies to the given tiers (default: all) and site types (default: both).
type Step = { id: string; label: string; hint?: string; tiers?: ServiceTier[]; sites?: ServiceSiteType[] };
type Group = { title: string; steps: Step[] };

const GROUPS: Group[] = [
  {
    title: "בפורטל",
    steps: [
      { id: "open", label: 'פתח את הפרויקט של הלקוח ולחץ "עריכת פרויקט".' },
      { id: "tier", label: 'בקטע "תוכנית שירות ותחזוקה" בחר את החבילה.' },
      { id: "type", label: 'בחר "סוג אתר".' },
      { id: "url", label: 'הזן את "כתובת האתר" המדויקת (https://...).', hint: "זה השדה שממנו נמשכות כל המטריקות. ה-host שלו מחבר Uptime ותעבורה ללקוח." },
      { id: "billing", label: "הגדר יום חיוב ותעריף שעתי (אם רלוונטי), ולחץ שמור." },
    ],
  },
  {
    title: "אחסון, רישיונות וגיבוי",
    steps: [
      { id: "cw-backup", label: "Cloudways: ודא שגיבוי יומי אוטומטי פעיל, ובדוק מדיניות שמירה.", sites: ["wordpress"] },
      { id: "cw-staging", label: "Cloudways: הגדר סביבת Staging לשכפול ובדיקות לפני Production.", sites: ["wordpress"] },
      { id: "wp-licenses", label: "התקן והפעל רישיונות: Elementor Pro + Crocoblock.", hint: "כלול בכל החבילות, שווי מעל 1,000 ₪ בשנה.", sites: ["wordpress"] },
      { id: "vercel", label: "Vercel: ודא פריסה אוטומטית מ-Git (Preview לכל branch + Production).", sites: ["custom"] },
      { id: "pgdump", label: "הקם גיבוי מסד נתונים: pg_dump מתוזמן (GitHub Actions) ל-Cloudflare R2.", sites: ["custom"] },
      { id: "double-backup", label: "גיבוי כפול: עותק נוסף ב-Cloudflare R2, במיקום נפרד מהאחסון הראשי.", tiers: ["ultra"] },
    ],
  },
  {
    title: "ניטור",
    steps: [
      { id: "uptime", label: "UptimeRobot: צור Monitor חדש עם אותו URL בדיוק.", hint: "ה-host חייב להיות זהה לכתובת שבחבילה, אחרת הזמינות לא תוצמד ללקוח." },
      { id: "uptime-1min", label: "UptimeRobot: שקול תדירות בדיקה של דקה (בתשלום).", tiers: ["ultra"] },
      { id: "cf-add", label: "Cloudflare: הוסף את הדומיין ל-Web Analytics (Add a site)." },
      { id: "cf-beacon", label: "Cloudflare: התקן את סקריפט הביקון (JS) באתר.", hint: "בוורדפרס דרך תוסף Footer (WPCode וכד')." },
      { id: "always-online", label: "Cloudflare: הפעל Always Online (Caching → Configuration → Toggle)." },
      { id: "psi", label: "PageSpeed: לא דורש כלום, רץ אוטומטית דרך המפתח הגלובלי." },
    ],
  },
  {
    title: "אבטחה",
    steps: [
      { id: "bot-fight", label: "Cloudflare: הפעל Bot Fight Mode (חסימת בוטים זדוניים)." },
      { id: "waf", label: "Cloudflare: ודא ש-WAF פעיל (כלול ב-Free)." },
      { id: "rate-limit", label: "Cloudflare: הגדר Rate Limiting על /wp-admin ו-/wp-login.", tiers: ["pro", "ultra"], sites: ["wordpress"] },
      { id: "turnstile", label: "Cloudflare: התקן Turnstile על טפסי יצירת קשר (הגנת ספאם בלתי נראית).", tiers: ["pro", "ultra"] },
      { id: "malware", label: "הפעל סריקות Malware בזמן אמת.", tiers: ["pro", "ultra"], sites: ["wordpress"] },
      { id: "dependabot", label: "הפעל Dependabot / npm audit ב-CI (סריקת חולשות ב-dependencies).", tiers: ["pro", "ultra"], sites: ["custom"] },
      { id: "checksums", label: "הקם cron ל-WP-CLI verify-checksums (בדיקת שלמות קבצים).", tiers: ["ultra"], sites: ["wordpress"] },
    ],
  },
  {
    title: "ביצועים",
    steps: [
      { id: "wp-rocket", label: "התקן והגדר WP Rocket (caching + minification).", sites: ["wordpress"] },
      { id: "img-manual", label: "המרת תמונות ידנית ל-WebP (CloudConvert) לפני העלאה.", tiers: ["core"], sites: ["wordpress"] },
      { id: "polish", label: "Cloudflare Polish: הפעל המרת תמונות אוטומטית ל-WebP/AVIF.", hint: "דורש Cloudflare Pro (~20$/אתר), מייתר המרה ידנית.", tiers: ["pro", "ultra"], sites: ["wordpress"] },
      { id: "cdn-code", label: "ודא CDN גלובלי מוגדר (Cloudflare) לטעינה מהירה מכל מקום.", sites: ["custom"] },
    ],
  },
  {
    title: "ליווי Ultra VIP",
    steps: [
      { id: "dedicated", label: "הגדר משאבי שרת ייעודיים (לא shared).", tiers: ["ultra"] },
      { id: "quarterly", label: "קבע פגישת חשיבה אסטרטגית רבעונית (10 דק' נתונים + 20 דק' כיוון).", tiers: ["ultra"] },
      { id: "priority", label: "סמן את הלקוח לקדימות בתור לעבודות דחופות.", tiers: ["ultra"] },
    ],
  },
  {
    title: "הפעלה ובדיקה",
    steps: [
      { id: "refresh", label: 'אדמין → חבילות תחזוקה → "רענן נתונים עכשיו".' },
      { id: "verify", label: 'ודא שהלקוח רואה ב"השירות שלך": מהירות, זמינות ותעבורה.', hint: "תעבורה מתמלאת רק אחרי שהביקון נאסף, ייתכן שיעברו כמה שעות." },
      { id: "report", label: "(רשות) שלח את הדוח החודשי הראשון." },
    ],
  },
];

function stepApplies(step: Step, tier: ServiceTier, site: ServiceSiteType) {
  return (!step.tiers || step.tiers.includes(tier)) && (!step.sites || step.sites.includes(site));
}

export function OnboardingChecklist() {
  const [tier, setTier] = useState<ServiceTier>("pro");
  const [site, setSite] = useState<ServiceSiteType>("wordpress");
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.tier) setTier(s.tier);
        if (s.site) setSite(s.site);
        if (s.done) setDone(s.done);
      }
    } catch { /* ignore */ }
  }, []);

  function persist(next: { tier?: ServiceTier; site?: ServiceSiteType; done?: Record<string, boolean> }) {
    const merged = { tier, site, done, ...next };
    if (next.tier !== undefined) setTier(next.tier);
    if (next.site !== undefined) setSite(next.site);
    if (next.done !== undefined) setDone(next.done);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  }

  const toggle = (id: string) => persist({ done: { ...done, [id]: !done[id] } });
  const reset = () => persist({ done: {} });

  // Only the steps relevant to the chosen package + site type.
  const groups = GROUPS
    .map((g) => ({ ...g, steps: g.steps.filter((s) => stepApplies(s, tier, site)) }))
    .filter((g) => g.steps.length > 0);
  const visibleSteps = groups.flatMap((g) => g.steps);
  const doneCount = visibleSteps.filter((s) => done[s.id]).length;
  const total = visibleSteps.length;
  const allDone = total > 0 && doneCount === total;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <ListChecks className="size-4" /> לקוח חדש? צ'ק-ליסט
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary" /> קליטת לקוח תחזוקה חדש
          </SheetTitle>
          <SheetDescription>
            בחר חבילה וסוג אתר, והצ'ק-ליסט יציג רק את השלבים הרלוונטיים. ההתקדמות נשמרת.
          </SheetDescription>
        </SheetHeader>

        {/* package + site type selectors */}
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">חבילה</span>
            <div className="flex gap-1.5">
              {TIER_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => persist({ tier: t })}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold transition-colors",
                    tier === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">סוג אתר</span>
            <div className="flex gap-1.5">
              {(["wordpress", "custom"] as ServiceSiteType[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => persist({ site: s })}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold transition-colors",
                    site === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {SITE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("font-semibold", allDone ? "text-primary" : "text-foreground")}>{doneCount}</span>
            <span className="text-muted-foreground">/ {total} הושלמו</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset} className="text-muted-foreground">
            <RotateCcw className="size-4" /> אתחל ללקוח חדש
          </Button>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
        </div>

        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h4>
              <div className="space-y-1.5">
                {group.steps.map((step) => {
                  const checked = !!done[step.id];
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => toggle(step.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors",
                        checked ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                        )}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="flex-1">
                        <span className={cn("block text-sm", checked && "text-muted-foreground line-through")}>{step.label}</span>
                        {step.hint && <span className="mt-1 block text-xs text-muted-foreground">{step.hint}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
