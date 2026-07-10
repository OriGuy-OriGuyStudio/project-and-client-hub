import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Zap, ShieldCheck, TrendingUp, RefreshCw, HeartHandshake, Sparkles, Gauge } from "lucide-react";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PerfChart } from "@/components/service/PerfChart";
import { fetchServicePreview } from "@/hooks/useService";
import { TIER_META, packageValue } from "@/lib/service-plans";

const GREEN = "#B4D670";
const STUDIO_WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

/** One report card: a big number, plain explanation, and "what's in it for you". */
function Block({ icon: Icon, kicker, value, explain, benefit, tone = "green" }: {
  icon: typeof Zap; kicker: string; value: string; explain: string; benefit: string; tone?: "green" | "cyan";
}) {
  const color = tone === "green" ? "text-primary" : "text-brand-cyan-base";
  const bg = tone === "green" ? "bg-primary/10" : "bg-brand-cyan-base/10";
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
      <p className="mt-2 rounded-xl bg-background/50 px-3 py-2 text-sm text-muted-foreground">
        <b className="text-foreground">מה יצא לך מזה:</b> {benefit}
      </p>
    </div>
  );
}

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
  const monthCount = (kinds: string[]) =>
    log.filter((m) => kinds.includes(m.kind) && new Date(m.occurred_at).getTime() >= monthStart.getTime())
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
            />
          )}
          {latest?.uptime_pct != null && (
            <Block
              icon={TrendingUp} tone="cyan" kicker="זמינות" value={`${latest.uptime_pct}%`}
              explain={uptimeExplain}
              benefit={uptimeBenefit}
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
