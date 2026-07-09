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
  const threatsMonth = metrics
    .filter((m) => new Date(`${m.metric_date}T00:00:00`).getTime() >= monthStart.getTime())
    .reduce((a, m) => a + (m.threats_blocked ?? 0), 0);

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
              explain={`האתר שלך נטען מהר${latest.lcp_ms != null ? ` (כ-${(latest.lcp_ms / 1000).toFixed(1)} שניות)` : ""}.`}
              benefit="מבקרים לא מתייאשים ועוזבים, וגם גוגל אוהב אתרים מהירים ומדרג אותך גבוה יותר."
            />
          )}
          {latest?.uptime_pct != null && (
            <Block
              icon={TrendingUp} tone="cyan" kicker="זמינות" value={`${latest.uptime_pct}%`}
              explain="האתר היה זמין כמעט כל הזמן החודש."
              benefit="הלקוחות שלך תמיד מוצאים אותך, בלי דלת סגורה ובלי הזדמנות שהולכת לאיבוד."
            />
          )}
          <Block
            icon={ShieldCheck} kicker="אבטחה" value={String(threatsMonth || summary.threats_total || 0)}
            explain="חסמנו ניסיונות גישה וזדונות לפני שהגיעו לאתר."
            benefit="המידע שלך ושל הלקוחות שלך מוגן, בלי שתצטרך לחשוב על זה."
          />
          <Block
            icon={RefreshCw} tone="cyan" kicker="עדכונים וגיבויים" value={`${updates} · ${backups}`}
            explain={`ביצענו ${updates} עדכונים ו-${backups} גיבויים החודש.`}
            benefit="האתר תמיד מעודכן ובטוח, ואם משהו משתבש, יש גיבוי לחזור אליו בשניות."
          />
          <Block
            icon={HeartHandshake} kicker="הליווי שלנו"
            value={`${summary.hours_month ? (Number.isInteger(summary.hours_month) ? summary.hours_month : summary.hours_month.toFixed(1)) : 0} שעות`}
            explain={`השקענו בך ${summary.hours_month ? summary.hours_month.toFixed(1) : 0} שעות עבודה${summary.service_calls_month ? `, וטיפלנו ב-${summary.service_calls_month} קריאות שירות` : ""} החודש.`}
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
