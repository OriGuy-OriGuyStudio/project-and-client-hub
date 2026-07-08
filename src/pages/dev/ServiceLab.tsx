import { useState } from "react";
import {
  ShieldCheck,
  Zap,
  DatabaseBackup,
  RefreshCw,
  Clock,
  Sparkles,
  TrendingUp,
  Gauge as GaugeIcon,
  FileText,
  Check,
  ArrowUpRight,
  Crown,
  Activity,
  Rocket,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DEV-ONLY mockup of the client-facing "השירות שלך" (service & maintenance) page,
 * with demo data, so Ori can approve the design before we wire real data.
 * Mounted at /__servicelab. Never ships.
 */

const GREEN = "#B4D670";
const CYAN = "#77BECF";

/* ---- tiny inline viz ---- */
function Ring({ value, color, label }: { value: number; color: string; label: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const off = C * (1 - value / 100);
  return (
    <div className="relative grid size-[110px] place-items-center">
      <svg viewBox="0 0 100 100" className="size-[110px] -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(246,244,244,.1)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-heading text-2xl font-bold" style={{ color }}>
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex h-14 items-end gap-1">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${Math.max(8, (d / max) * 100)}%`, background: i === data.length - 1 ? color : "rgba(246,244,244,.18)" }}
        />
      ))}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone = "green",
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "cyan" | "plain";
}) {
  const color = tone === "green" ? GREEN : tone === "cyan" ? CYAN : undefined;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid size-8 place-items-center rounded-lg"
          style={{ background: `${color ?? "#888"}1f`, color: color ?? "var(--muted-foreground)" }}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

type SiteType = "wordpress" | "ai";

type MetricDef = { icon: typeof Zap; label: string; value: string; sub: string; tone: "green" | "cyan" };

const TYPES: Record<
  SiteType,
  { chip: string; features: string[]; metrics: MetricDef[]; cumulative: { v: string; l: string }[]; roi: React.ReactNode }
> = {
  wordpress: {
    chip: "אתר WordPress",
    features: [
      "אחסון פרימיום, עדכונים וגיבויים בטוחים",
      "חבילת רישיונות בשווי ₪1,172 (Elementor Pro, Crocoblock)",
      "מאיץ מהירות Cloudflare Enterprise",
      "הגנת Malware וסריקות בזמן אמת",
      "בדיקת ביצועים ומהירות חודשית",
      "עד 3 שעות עבודה / ייעוץ בחודש",
      "עדיפות VIP, תגובה עד 24 שעות",
    ],
    metrics: [
      { icon: RefreshCw, label: "עדכונים שבוצעו", value: "12", sub: "ליבה + תוספים", tone: "green" },
      { icon: DatabaseBackup, label: "גיבויים", value: "30", sub: "אחרון: לפני שעתיים", tone: "cyan" },
      { icon: ShieldCheck, label: "איומים שנחסמו", value: "47", sub: "Malware + Firewall", tone: "green" },
      { icon: TrendingUp, label: "זמינות (Uptime)", value: "99.98%", sub: "30 יום אחרונים", tone: "cyan" },
      { icon: Clock, label: "שעות שנוצלו", value: "1.5 / 3", sub: "ייעוץ ופיתוח", tone: "green" },
      { icon: Zap, label: "קריאות שירות", value: "2", sub: "תגובה ממוצעת: 3ש", tone: "cyan" },
    ],
    cumulative: [
      { v: "148", l: "עדכונים" },
      { v: "420", l: "גיבויים" },
      { v: "1,830", l: "איומים נחסמו" },
      { v: "₪1,172", l: "רישיונות בחינם / חודש" },
    ],
    roi: (
      <>
        החבילה שלך עולה <b className="text-foreground">₪800</b>, אבל הרישיונות והתשתית לבדם שווים מעל{" "}
        <b className="text-primary">₪1,400</b> בחודש.
      </>
    ),
  },
  ai: {
    chip: "אתר מותאם אישית",
    features: [
      "אחסון edge ופריסה אוטומטית מ-Git",
      "רשת CDN גלובלית ומהירה (Cloudflare)",
      "SSL, גיבויי קוד ומסד נתונים",
      "סריקת חולשות אבטחה ב-dependencies",
      "בדיקת ביצועים ומהירות חודשית",
      "עד 3 שעות פיתוח / ייעוץ בחודש",
      "עדיפות VIP, תגובה עד 24 שעות",
    ],
    metrics: [
      { icon: Rocket, label: "פריסות (deploys)", value: "8", sub: "עדכוני קוד + תוכן", tone: "green" },
      { icon: DatabaseBackup, label: "גיבויים", value: "30", sub: "Git + DB · לפני שעה", tone: "cyan" },
      { icon: ShieldCheck, label: "איומים שנחסמו", value: "47", sub: "Cloudflare Firewall", tone: "green" },
      { icon: TrendingUp, label: "זמינות (Uptime)", value: "99.99%", sub: "30 יום אחרונים", tone: "cyan" },
      { icon: Clock, label: "שעות שנוצלו", value: "1.5 / 3", sub: "פיתוח וייעוץ", tone: "green" },
      { icon: Zap, label: "קריאות שירות", value: "2", sub: "תגובה ממוצעת: 3ש", tone: "cyan" },
    ],
    cumulative: [
      { v: "96", l: "פריסות" },
      { v: "420", l: "גיבויים" },
      { v: "1,830", l: "איומים נחסמו" },
      { v: "Edge + CDN", l: "תשתית פרימיום" },
    ],
    roi: (
      <>
        החבילה שלך עולה <b className="text-foreground">₪800</b>, אבל האחסון, ה-CDN וזמן הפיתוח השוטף שווים{" "}
        <b className="text-primary">הרבה יותר</b>.
      </>
    ),
  },
};

export default function ServiceLab() {
  const [type, setType] = useState<SiteType>("wordpress");
  const t = TYPES[type];
  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-4xl space-y-6 bg-background p-6 text-foreground">
      <p className="text-center text-xs text-muted-foreground">מוקאפ (DEV): עמוד "השירות שלך" ללקוח</p>

      {/* DEV toggle — in production the site type comes from the project */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-full border border-border/60 bg-card/60 p-1">
          {(["wordpress", "ai"] as SiteType[]).map((st) => (
            <button
              key={st}
              onClick={() => setType(st)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                type === st ? "bg-primary text-[color:var(--ink,#0a0623)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {st === "wordpress" ? <Globe className="size-4" /> : <Rocket className="size-4" />}
              {st === "wordpress" ? "WordPress" : "אתר מותאם אישית"}
            </button>
          ))}
        </div>
      </div>

      {/* header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">השירות שלך</h1>
        <p className="text-sm text-muted-foreground">
          השותף הטכנולוגי שדואג שהאתר שלך יהיה מהיר, מאובטח ומעודכן, כל הזמן.
        </p>
      </div>

      {/* plan hero */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25 blur-3xl"
          style={{ background: `radial-gradient(60% 60% at 70% 0%, ${GREEN}, transparent)` }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Crown className="size-3.5" /> החבילה שלך
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                {type === "wordpress" ? <Globe className="size-3.5" /> : <Rocket className="size-3.5" />} {t.chip}
              </span>
            </div>
            <h2 className="mt-3 font-heading text-3xl font-black text-foreground">Studio Pro</h2>
            <p className="text-sm text-muted-foreground">ביצוע פרימיום , השותף הטכנולוגי שלך</p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                <b className="font-heading text-lg text-foreground">₪800</b> / חודש
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-brand-cyan-base/10 px-3 py-1 text-xs text-brand-cyan-base">
                <Clock className="size-3.5" /> תגובה עד 24 שעות
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <Ring value={96} color={GREEN} label="בריאות" />
            <p className="mt-1 text-xs text-muted-foreground">ציון בריאות האתר</p>
          </div>
        </div>

        {/* included */}
        <div className="relative mt-6 grid gap-2 border-t border-border/60 pt-5 sm:grid-cols-2">
          {t.features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* what we did this month */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Activity className="size-5 text-primary" /> מה עשינו החודש
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {t.metrics.map((m) => (
            <Metric key={m.label} icon={m.icon} label={m.label} value={m.value} sub={m.sub} tone={m.tone} />
          ))}
        </div>
      </div>

      {/* site performance */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <GaugeIcon className="size-5 text-brand-cyan-base" /> ביצועי האתר
        </h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">תנועה, 7 ימים אחרונים</p>
              <span className="text-xs text-muted-foreground">
                <b className="text-foreground">1,284</b> מבקרים · <b className="text-foreground">2,077</b> צפיות
              </span>
            </div>
            <Spark data={[120, 180, 150, 210, 190, 240, 194]} color={CYAN} />
            <p className="mt-2 text-xs text-muted-foreground">מקורות: אורגני 58% · ישיר 24% · סושיאל 18%</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4">
            <Ring value={92} color={CYAN} label="PageSpeed" />
            <p className="mt-2 text-center text-xs font-semibold text-primary">
              <ArrowUpRight className="inline size-3.5" /> מהיר ב-32% מאז ההשקה
            </p>
            <p className="text-[11px] text-muted-foreground">LCP 1.2s · CLS 0.02 · INP 90ms</p>
          </div>
        </div>
      </div>

      {/* cumulative value */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Sparkles className="size-5 text-primary" /> הערך שקיבלת מאז ההצטרפות
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {t.cumulative.map((x) => (
            <div key={x.l} className="text-center">
              <p className="font-heading text-2xl font-black text-primary">{x.v}</p>
              <p className="text-[11px] text-muted-foreground">{x.l}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-card/60 p-3 text-center text-sm text-muted-foreground">{t.roi}</p>
      </div>

      {/* monthly reports */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <FileText className="size-5 text-brand-cyan-base" /> דוחות חודשיים
        </h3>
        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
          {["יוני 2026", "מאי 2026", "אפריל 2026"].map((m) => (
            <div key={m} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <FileText className="size-4 text-muted-foreground" /> דו"ח שירות , {m}
              </span>
              <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                הורדה <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* upsell */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand-cyan-base/30 bg-brand-cyan-base/5 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-heading font-semibold text-foreground">רוצה שקט מוחלט?</p>
          <p className="text-sm text-muted-foreground">
            שדרג ל-Studio Ultra VIP: שרת פרטי, תגובה עד 4 שעות, ו-7 שעות ייעוץ בחודש.
          </p>
        </div>
        <button
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--ink,#0a0623)]"
          style={{ background: CYAN }}
        >
          שדרוג ל-Ultra VIP
        </button>
      </div>
    </div>
  );
}
