import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Zap, ShieldCheck, TrendingUp, RefreshCw, HeartHandshake, Sparkles, Gauge,
  Lock, DatabaseBackup, Check, ClipboardList, ArrowUp, ArrowDown, Search, Rocket, StickyNote, Wrench,
} from "lucide-react";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PerfChart } from "@/components/service/PerfChart";
import { fetchServicePreview } from "@/hooks/useService";
import { TIER_META, packageValue } from "@/lib/service-plans";
import type { MaintenanceLog } from "@/types/database";

const GREEN = "#B4D670";
const STUDIO_WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

/** One report card: a big number, plain explanation, and "what's in it for you". */
function Block({ icon: Icon, kicker, value, explain, benefit, tone = "green", trend }: {
  icon: typeof Zap; kicker: string; value: string; explain: string; benefit: string;
  tone?: "green" | "cyan"; trend?: { text: string; dir: "up" | "down" | "flat" } | null;
}) {
  const color = tone === "green" ? "text-primary" : "text-brand-cyan-base";
  const bg = tone === "green" ? "bg-primary/10" : "bg-brand-cyan-base/10";
  const TrendIcon = trend?.dir === "up" ? ArrowUp : trend?.dir === "down" ? ArrowDown : null;
  const trendColor = trend?.dir === "up" ? "text-primary" : trend?.dir === "down" ? "text-amber-400" : "text-muted-foreground";
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-2xl ${bg} ${color}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{kicker}</p>
          <p className={`font-heading text-3xl font-black ${color}`}>{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground">{explain}</p>
      {trend && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
          {TrendIcon && <TrendIcon className="size-3.5" />} {trend.text}
        </p>
      )}
      <p className="mt-2 rounded-xl bg-background/50 px-3 py-2 text-sm text-muted-foreground">
        <b className="text-foreground">מה יצא לך מזה:</b> {benefit}
      </p>
    </div>
  );
}

const LOG_META: Record<MaintenanceLog["kind"], { label: string; icon: typeof Zap }> = {
  update: { label: "עדכון תוכנה", icon: RefreshCw },
  deploy: { label: "עדכון גרסה לאתר", icon: Rocket },
  backup: { label: "גיבוי מלא", icon: DatabaseBackup },
  scan: { label: "סריקת אבטחה", icon: Search },
  service_call: { label: "קריאת שירות", icon: Wrench },
  note: { label: "עדכון", icon: StickyNote },
};

export default function ClientReport() {
  const { token = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["service-report", token],
    enabled: !!token,
    queryFn: () => fetchServicePreview(token),
  });

  const monthLabel = useMemo(() => new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" }), []);

  if (isLoading) {
    return <div dir="rtl" className="grid min-h-screen place-items-center bg-background"><CenteredLoader label="טוען…" /></div>;
  }
  if (!data) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-background p-6">
        <EmptyState icon={ShieldCheck} title="הדוח אינו זמין" description="ייתכן שהקישור פג. אפשר לפנות לסטודיו לקבלת דוח מעודכן." />
      </div>
    );
  }

  const { service, business_name, metrics, log, summary } = data;
  const meta = TIER_META[service.tier];
  const price = Number(service.monthly_price ?? meta.price);
  const latest = metrics[0];

  // this-month maintenance counts, from the log
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const inThisMonth = (iso: string) => new Date(iso).getTime() >= monthStart.getTime();
  const monthCount = (kinds: string[]) =>
    log.filter((m) => kinds.includes(m.kind) && inThisMonth(m.occurred_at))
      .reduce((a, m) => a + (m.count ?? 1), 0);
  const updates = monthCount(["update", "deploy"]);
  const backups = monthCount(["backup"]);

  // Dynamic copy: the wording MUST match the actual numbers (never claim "fast"
  // on a low score, or "we blocked" when zero). threats_blocked is a rolling
  // 30-day total per row, so we read the latest value, never sum it.
  const ps = latest?.pagespeed ?? null;
  const lcpNote = latest?.lcp_ms != null ? ` (כ-${(latest.lcp_ms / 1000).toFixed(1)} שניות)` : "";
  const speedExplain =
    ps == null ? "" :
    ps >= 90 ? `האתר שלך נטען מהר מאוד${lcpNote}.` :
    ps >= 70 ? `האתר שלך נטען במהירות טובה${lcpNote}.` :
    ps >= 50 ? `יש מקום לשפר את מהירות האתר${lcpNote}, ואנחנו עובדים על זה.` :
    `מהירות האתר דורשת שיפור${lcpNote}, וזה בטיפול אצלנו.`;
  const speedBenefit = ps != null && ps >= 70
    ? "מבקרים לא מתייאשים ועוזבים, וגם גוגל אוהב אתרים מהירים ומדרג אותך גבוה יותר."
    : "שיפור המהירות ישמור על המבקרים באתר וישפר את הדירוג בגוגל, ואנחנו על זה.";

  const up = latest?.uptime_pct != null ? Number(latest.uptime_pct) : null;
  const uptimeExplain =
    up == null ? "" :
    up >= 100 ? "האתר היה זמין לאורך כל החודש, בלי אף נפילה." :
    up >= 99.9 ? "האתר היה זמין כמעט כל הזמן החודש." :
    up >= 99 ? "האתר היה זמין כמעט כל הזמן, עם כמה רגעים בודדים בלבד." :
    "היו החודש כמה הפרעות בזמינות, ואנחנו במעקב צמוד כדי לצמצם אותן.";
  const uptimeBenefit = up != null && up >= 99
    ? "הלקוחות שלך תמיד מוצאים אותך, בלי דלת סגורה ובלי הזדמנות שהולכת לאיבוד."
    : "אנחנו עוקבים אחרי הזמינות מסביב לשעון ומטפלים בכל נפילה מיד.";

  const threats = latest?.threats_blocked ?? 0;
  const threatsExplain = threats > 0
    ? `חסמנו ${threats} ניסיונות גישה וזדונות לפני שהגיעו לאתר.`
    : "לא זוהו ניסיונות חדירה בחודש האחרון, ההגנות פעילות והאתר נקי.";
  const threatsBenefit = threats > 0
    ? "המידע שלך ושל הלקוחות שלך מוגן, בלי שתצטרך לחשוב על זה."
    : "ההגנות רצות ברקע כל הזמן, כך שהאתר מוגן גם כשאין תקיפות.";

  const updBackExplain =
    updates > 0 && backups > 0 ? `ביצענו ${updates} עדכונים ו-${backups} גיבויים החודש.` :
    updates > 0 ? `ביצענו ${updates} עדכונים החודש, והגיבויים רצים אוטומטית ברקע.` :
    backups > 0 ? `בוצעו ${backups} גיבויים אוטומטיים החודש, ולא נדרשו עדכונים מיוחדים.` :
    "האתר יציב, והגיבויים האוטומטיים ממשיכים לרוץ ברקע.";

  const hoursNum = summary.hours_month ?? 0;
  const hoursExplain =
    hoursNum > 0
      ? `השקענו בך ${hoursNum.toFixed(1)} שעות עבודה${summary.service_calls_month ? `, וטיפלנו ב-${summary.service_calls_month} קריאות שירות` : ""} החודש.`
      : summary.service_calls_month
        ? `החודש טיפלנו ב-${summary.service_calls_month} קריאות שירות, והכול התנהל חלק.`
        : "החודש הכול התנהל חלק, בלי צורך בעבודה נוספת.";

  const rate = service.hourly_rate != null ? Number(service.hourly_rate) : 0;
  const hoursVal = Math.round((Math.round((summary.hours_month ?? 0) * 10) / 10) * rate);
  const val = packageValue(service.tier, service.site_type, rate || null);
  const waHref = STUDIO_WHATSAPP
    ? `https://wa.me/${String(STUDIO_WHATSAPP).replace(/\D/g, "")}?text=${encodeURIComponent(`היי אורי, קיבלתי את הדוח של ${business_name} ורציתי לשאול`)}`
    : undefined;

  // Month-over-month: compare the latest metric with the newest reading that is
  // at least ~3 weeks older, so the delta is genuinely "vs last month". If we
  // don't have that much history yet, we simply omit the trend (never fake it).
  const prevMetric = (() => {
    if (!latest?.metric_date) return null;
    const latestT = new Date(latest.metric_date).getTime();
    return metrics.find((m) => m.metric_date && latestT - new Date(m.metric_date).getTime() >= 21 * 864e5) ?? null;
  })();
  const mkTrend = (cur: number | null, prev: number | null | undefined, unit: string, betterUp = true) => {
    if (cur == null || prev == null) return null;
    const d = Math.round((cur - Number(prev)) * 10) / 10;
    if (d === 0) return { text: "כמו החודש שעבר, יציב", dir: "flat" as const };
    const improved = betterUp ? d > 0 : d < 0;
    const mag = Math.abs(d);
    return {
      text: improved ? `עלייה של ${mag}${unit} מהחודש שעבר` : `ירידה של ${mag}${unit} מהחודש שעבר, בטיפול`,
      dir: (improved ? "up" : "down") as "up" | "down",
    };
  };
  const speedTrend = mkTrend(ps, prevMetric?.pagespeed, " נק'");
  const uptimeTrend = mkTrend(up, prevMetric?.uptime_pct != null ? Number(prevMetric.uptime_pct) : null, "%");

  // "What we did this month" — the concrete log entries, newest first.
  const monthLog = log.filter((m) => inThisMonth(m.occurred_at));
  const SHOWN = 8;
  const shownLog = monthLog.slice(0, SHOWN);
  const extraLog = monthLog.length - shownLog.length;

  // Always-on protective layers — every item here is architecturally true for
  // the setup (CF edge + Supabase), so the security story feels full even at 0
  // blocked threats. No claim we can't back up.
  const guards: { icon: typeof Zap; label: string; note: string }[] = [
    { icon: Lock, label: "חיבור מוצפן (HTTPS)", note: "כל התעבורה לאתר ומהאתר מוצפנת מקצה לקצה." },
    { icon: ShieldCheck, label: "סינון תעבורה בשכבת הרשת", note: "בקשות זדוניות נחסמות עוד לפני שהן מגיעות לאתר." },
    { icon: TrendingUp, label: "ניטור זמינות 24/7", note: "אנחנו יודעים על נפילה לפני שאתה, ומטפלים מיד." },
    { icon: DatabaseBackup, label: "גיבויים אוטומטיים", note: "עותק עדכני נשמר כל הזמן, כדי שאפשר יהיה לשחזר בשניות." },
  ];

  // Personal opener in Ori's own voice — the headline adapts to the real month.
  const opener =
    up != null && up >= 100 && ps != null && ps >= 90
      ? "חודש חלק במיוחד, האתר היה מהיר וזמין לאורך כל הדרך."
      : threats > 0
        ? `בין השאר חסמתי ${threats} ניסיונות גישה לא רצויים לפני שהגיעו אליך.`
        : updates > 0 || backups > 0
          ? "שמרתי על האתר מעודכן ומגובה, בלי שתצטרך לחשוב על זה."
          : "האתר רץ יציב, ואני ממשיך לעקוב מקרוב.";

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> הדוח החודשי שלך
          </span>
          <h1 className="mt-4 font-heading text-3xl font-black sm:text-4xl">{business_name}</h1>
          <p className="mt-1 text-muted-foreground">סיכום {monthLabel}, מה עשינו כדי שהאתר שלך יהיה מהיר, זמין ומאובטח</p>
        </div>

        {/* personal opener */}
        <div className="mt-6 rounded-3xl border border-primary/25 bg-primary/5 p-6">
          <p className="text-[15px] leading-relaxed text-foreground">
            היי, כאן אורי. הנה מה שקרה מאחורי הקלעים של <b>{business_name}</b> ב{monthLabel}. {opener} אני כאן כדי
            שהאתר שלך פשוט יעבוד, ואתה תתפנה לעסק.
          </p>
        </div>

        {/* speed trend */}
        {metrics.length >= 2 && latest?.pagespeed != null && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gauge className="size-4 text-primary" /> מגמת המהירות שלך
            </p>
            <PerfChart metrics={metrics} field="pagespeed" color={GREEN} name="מהירות" domain={[0, 100]} />
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {latest?.pagespeed != null && (
            <Block
              icon={Zap} kicker="מהירות האתר" value={`${latest.pagespeed}/100`}
              explain={speedExplain}
              benefit={speedBenefit}
              trend={speedTrend}
            />
          )}
          {latest?.uptime_pct != null && (
            <Block
              icon={TrendingUp} tone="cyan" kicker="זמינות" value={`${latest.uptime_pct}%`}
              explain={uptimeExplain}
              benefit={uptimeBenefit}
              trend={uptimeTrend}
            />
          )}
          <Block
            icon={ShieldCheck} kicker="אבטחה" value={String(threats)}
            explain={threatsExplain}
            benefit={threatsBenefit}
          />
          <Block
            icon={RefreshCw} tone="cyan" kicker="עדכונים וגיבויים" value={`${updates} · ${backups}`}
            explain={updBackExplain}
            benefit="האתר תמיד מעודכן ובטוח, ואם משהו משתבש, יש גיבוי לחזור אליו בשניות."
          />
          <Block
            icon={HeartHandshake} kicker="הליווי שלנו"
            value={`${summary.hours_month ? (Number.isInteger(summary.hours_month) ? summary.hours_month : summary.hours_month.toFixed(1)) : 0} שעות`}
            explain={hoursExplain}
            benefit="יש לך שותף טכנולוגי שדואג לאתר במקומך, אתה מתעסק בעסק, אני באתר."
          />
          {hoursVal > 0 && (
            <Block
              icon={Sparkles} tone="cyan" kicker="הערך שקיבלת" value={shekel(hoursVal + val.infra + val.licenseMonthly)}
              explain={`רק שעות העבודה החודש שוות ${shekel(hoursVal)}${val.licenseAnnual > 0 ? `, בנוסף לרישיונות בשווי ${shekel(val.licenseAnnual)} בשנה` : ""}.`}
              benefit={`הכול כלול ב-${shekel(price)} לחודש, בלי הפתעות ובלי חשבונות מפתיעים.`}
            />
          )}
        </div>

        {/* what we did this month */}
        <div className="mt-8 rounded-3xl border border-border bg-card p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="size-4 text-primary" /> מה עשינו החודש
          </p>
          {shownLog.length > 0 ? (
            <ul className="space-y-2.5">
              {shownLog.map((m) => {
                const lm = LOG_META[m.kind] ?? LOG_META.note;
                const Icon = lm.icon;
                const date = new Date(m.occurred_at).toLocaleDateString("he-IL", { day: "numeric", month: "long" });
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2.5 text-sm">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1 text-foreground">
                      {m.title || lm.label}
                      {m.count > 1 && <span className="text-muted-foreground"> ({m.count})</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{date}</span>
                  </li>
                );
              })}
              {extraLog > 0 && (
                <li className="px-3 pt-1 text-xs text-muted-foreground">ועוד {extraLog} פעולות תחזוקה החודש.</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              החודש האתר רץ חלק ולא נדרשה התערבות מיוחדת. הניטור, העדכונים והגיבויים ממשיכים לרוץ אוטומטית ברקע.
            </p>
          )}
        </div>

        {/* protective layers — always-on security */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" /> שכבות ההגנה שרצות עליך כל הזמן
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {guards.map((g) => (
              <div key={g.label} className="flex items-start gap-3 rounded-xl bg-background/50 p-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <g.icon className="size-4" />
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Check className="size-3.5 text-primary" /> {g.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-3xl border border-primary/30 bg-primary/5 p-6 text-center">
          <p className="font-heading text-lg font-semibold text-foreground">יש שאלה, רעיון או משהו שצריך?</p>
          <p className="mt-1 text-sm text-muted-foreground">אני כאן, פשוט שלח לי הודעה ונדבר.</p>
          {waHref && (
            <a
              href={waHref} target="_blank" rel="noreferrer noopener"
              className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-[color:var(--ink,#0a0623)]"
            >
              דברו איתי
            </a>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Orion · Studio Ori Guy</p>
      </div>
    </div>
  );
}
