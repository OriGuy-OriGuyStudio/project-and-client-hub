import { useMemo, useState } from "react";
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
  Crown,
  Activity,
  Rocket,
  Globe,
  HeartHandshake,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import {
  useMyServices,
  useSiteMetrics,
  useMaintenanceLog,
  useServiceSummary,
} from "@/hooks/useService";
import {
  TIER_META,
  tierFeatures,
  infraValue,
  type ServiceTier,
} from "@/lib/service-plans";
import type { ProjectService } from "@/types/database";

const GREEN = "#B4D670";
const CYAN = "#77BECF";

/* ---------- tiny inline viz ---------- */
function Ring({ value, color, label }: { value: number; color: string; label: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
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
          strokeDashoffset={C * (1 - value / 100)}
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
  const max = Math.max(1, ...data);
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
  tone?: "green" | "cyan";
}) {
  const color = tone === "green" ? GREEN : CYAN;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>
          <Icon className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const hoursLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/* ---------- one project's service board ---------- */
function ServiceBoard({ svc, projectName }: { svc: ProjectService; projectName: string }) {
  const meta = TIER_META[svc.tier];
  const price = Number(svc.monthly_price ?? meta.price);
  const wp = svc.site_type === "wordpress";
  const { data: metrics = [] } = useSiteMetrics(svc.project_id, 30);
  const { data: log = [] } = useMaintenanceLog(svc.project_id, 40);
  const { data: summary } = useServiceSummary(svc.project_id);

  const latest = metrics[0];
  const traffic7 = useMemo(() => metrics.slice(0, 7).reverse().map((m) => m.visitors ?? 0), [metrics]);
  const hasTraffic = traffic7.some((v) => v > 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCount = (kinds: string[]) =>
    log.filter((m) => kinds.includes(m.kind) && new Date(m.occurred_at).getTime() >= monthStart.getTime())
      .reduce((a, m) => a + (m.count ?? 1), 0);

  const nextTier: ServiceTier | null =
    svc.tier === "core" ? "pro" : svc.tier === "pro" ? "ultra" : null;

  // next billing date
  const now = new Date();
  const bill = new Date(now.getFullYear(), now.getMonth(), svc.billing_day);
  if (bill < now) bill.setMonth(bill.getMonth() + 1);
  const nextBilling = bill.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const totalVisitors = metrics.reduce((a, m) => a + (m.visitors ?? 0), 0);
  const totalViews = metrics.reduce((a, m) => a + (m.pageviews ?? 0), 0);

  return (
    <div className="space-y-6">
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
                {wp ? <Globe className="size-3.5" /> : <Rocket className="size-3.5" />}{" "}
                {wp ? "אתר WordPress" : "אתר מותאם אישית"}
              </span>
            </div>
            <h2 className="mt-3 font-heading text-3xl font-black text-foreground">{meta.name}</h2>
            <p className="text-sm text-muted-foreground">
              {meta.label} , {projectName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                <b className="font-heading text-lg text-foreground">₪{price.toLocaleString("he-IL")}</b> / חודש
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-brand-cyan-base/10 px-3 py-1 text-xs text-brand-cyan-base">
                <Clock className="size-3.5" /> תגובה עד {meta.responseHours} שעות
              </span>
              <span className="text-xs text-muted-foreground">חיוב הבא: {nextBilling}</span>
            </div>
          </div>
          {latest?.pagespeed != null && (
            <div className="flex flex-col items-center">
              <Ring value={latest.pagespeed} color={GREEN} label="בריאות" />
              <p className="mt-1 text-xs text-muted-foreground">ציון בריאות האתר</p>
            </div>
          )}
        </div>

        <div className="relative mt-6 grid gap-2 border-t border-border/60 pt-5 sm:grid-cols-2">
          {tierFeatures(svc.tier, svc.site_type).map((f) => (
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
          <Metric
            icon={wp ? RefreshCw : Rocket}
            label={wp ? "עדכונים שבוצעו" : "פריסות (deploys)"}
            value={String(monthCount(wp ? ["update"] : ["deploy", "update"]))}
            sub={wp ? "ליבה + תוספים" : "עדכוני קוד + תוכן"}
          />
          <Metric icon={DatabaseBackup} label="גיבויים" value={String(monthCount(["backup"]))} sub="החודש" tone="cyan" />
          <Metric
            icon={ShieldCheck}
            label="איומים שנחסמו"
            value={latest?.threats_blocked != null ? String(latest.threats_blocked) : "בקרוב"}
            sub={wp ? "Malware + Firewall" : "Cloudflare Firewall"}
          />
          <Metric
            icon={TrendingUp}
            label="זמינות (Uptime)"
            value={latest?.uptime_pct != null ? `${latest.uptime_pct}%` : "בקרוב"}
            sub="30 יום אחרונים"
            tone="cyan"
          />
          {meta.hours > 0 && (
            <Metric
              icon={Clock}
              label="שעות שנוצלו"
              value={`${hoursLabel(summary?.hours_month ?? 0)} / ${meta.hours}`}
              sub="ייעוץ ופיתוח"
            />
          )}
          <Metric
            icon={Zap}
            label="קריאות שירות"
            value={String(summary?.service_calls_month ?? 0)}
            sub="החודש"
            tone="cyan"
          />
        </div>
      </div>

      {/* site performance */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <GaugeIcon className="size-5 text-brand-cyan-base" /> ביצועי האתר
        </h3>
        {!latest ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            נתוני הביצועים (תנועה, מהירות, זמינות) יתחילו להופיע כאן ברגע שהניטור יופעל לאתר שלך.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">תנועה, 7 ימים אחרונים</p>
                <span className="text-xs text-muted-foreground">
                  <b className="text-foreground">{totalVisitors.toLocaleString("he-IL")}</b> מבקרים ·{" "}
                  <b className="text-foreground">{totalViews.toLocaleString("he-IL")}</b> צפיות
                </span>
              </div>
              {hasTraffic ? (
                <Spark data={traffic7} color={CYAN} />
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">נתוני תנועה יופיעו בקרוב.</p>
              )}
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4">
              {latest.pagespeed != null ? (
                <>
                  <Ring value={latest.pagespeed} color={CYAN} label="PageSpeed" />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {[latest.lcp_ms != null && `LCP ${(latest.lcp_ms / 1000).toFixed(1)}s`, latest.cls != null && `CLS ${latest.cls}`, latest.inp_ms != null && `INP ${latest.inp_ms}ms`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </>
              ) : (
                <p className="text-center text-xs text-muted-foreground">ציון מהירות יופיע בקרוב.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* cumulative value */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Sparkles className="size-5 text-primary" /> הערך שקיבלת מאיתנו
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{summary?.updates_total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{wp ? "עדכונים" : "פריסות"}</p>
          </div>
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{summary?.backups_total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">גיבויים</p>
          </div>
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{summary?.threats_total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">איומים נחסמו</p>
          </div>
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{hoursLabel(summary?.hours_total ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">שעות עבודה</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-card/60 p-3 text-center text-sm text-muted-foreground">
          החבילה שלך עולה <b className="text-foreground">₪{price.toLocaleString("he-IL")}</b>, אבל {infraValue(svc.site_type)}.
        </p>
      </div>

      {/* recent activity log */}
      {log.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <FileText className="size-5 text-brand-cyan-base" /> יומן פעילות
          </h3>
          <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
            {log.slice(0, 12).map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-foreground">{m.title || KIND_HE[m.kind]}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.occurred_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* upsell */}
      {nextTier && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand-cyan-base/30 bg-brand-cyan-base/5 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-heading font-semibold text-foreground">רוצה עוד?</p>
            <p className="text-sm text-muted-foreground">
              שדרג ל-{TIER_META[nextTier].name}: תגובה עד {TIER_META[nextTier].responseHours} שעות
              {TIER_META[nextTier].hours > 0 ? `, עד ${TIER_META[nextTier].hours} שעות עבודה בחודש` : ""}.
            </p>
          </div>
          <span className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--ink,#0a0623)]" style={{ background: CYAN }}>
            דבר איתנו על שדרוג
          </span>
        </div>
      )}
    </div>
  );
}

const KIND_HE: Record<string, string> = {
  update: "עדכון",
  backup: "גיבוי",
  scan: "סריקת אבטחה",
  deploy: "פריסה",
  service_call: "קריאת שירות",
  note: "הערה",
};

export default function Service() {
  const { data: services = [], isLoading } = useMyServices();
  const { data: projects = [] } = useProjects();
  const [activeId, setActiveId] = useState<string | undefined>();

  const projName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? p.business_name || p.title : "האתר שלך";
  };

  const current = services.find((s) => s.project_id === activeId) ?? services[0];

  return (
    <div>
      <PageHeader
        title="השירות שלך"
        subtitle="השותף הטכנולוגי שדואג שהאתר שלך יהיה מהיר, מאובטח ומעודכן, כל הזמן."
      />

      {isLoading ? (
        <CenteredLoader label="טוען…" />
      ) : !current ? (
        <EmptyState
          icon={HeartHandshake}
          title="אין חבילת שירות פעילה"
          description="עדיין לא משויכת אליך חבילת ליווי ותחזוקה. דבר איתנו כדי לשמור על האתר מהיר ומאובטח."
        />
      ) : (
        <div className="space-y-4">
          {services.length > 1 && (
            <div className="inline-flex flex-wrap gap-1 rounded-full border border-border/60 bg-card/60 p-1">
              {services.map((s) => (
                <button
                  key={s.project_id}
                  onClick={() => setActiveId(s.project_id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    s.project_id === current.project_id
                      ? "bg-primary text-[color:var(--ink,#0a0623)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {projName(s.project_id)}
                </button>
              ))}
            </div>
          )}
          <ServiceBoard svc={current} projectName={projName(current.project_id)} />
        </div>
      )}
    </div>
  );
}
