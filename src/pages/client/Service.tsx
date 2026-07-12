import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  LifeBuoy,
  Paperclip,
  X,
  Bot,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FancyButton } from "@/components/ui/fancy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { gendered } from "@/lib/gender";
import { toast, toastError } from "@/hooks/use-toast";
import { notifyAdminTask } from "@/lib/invite";
import { uploadServiceCallMedia } from "@/lib/files";
import { PerfChart } from "@/components/service/PerfChart";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useMyCapabilities } from "@/hooks/useMyCapabilities";
import {
  useMyServices,
  useMyAgreements,
  useSiteMetrics,
  useMaintenanceLog,
  useServiceSummary,
  useServiceCalls,
  useServiceMoney,
  openServiceCall,
  type ServiceSummary,
} from "@/hooks/useService";
import {
  TIER_META,
  tierFeatures,
  packageValue,
  type ServiceTier,
} from "@/lib/service-plans";
import type { ProjectService, ServiceCallStatus, ServiceCallAttachment, SiteMetric, MaintenanceLog } from "@/types/database";

const SC_STATUS_HE: Record<ServiceCallStatus, string> = {
  new: "התקבלה",
  scheduled: "מתוזמנת",
  in_progress: "בטיפול",
  done: "טופלה",
  cancelled: "בוטלה",
};

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

/** "עודכן לאחרונה" date + time, Hebrew. */
const fmtUpdated = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const hoursLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** Round to a single decimal so ₪ value matches the shown hours (3.9×300=1170, not 1176). */
const roundH = (n: number) => Math.round(n * 10) / 10;

/* ---------- open a service call ---------- */
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50MB, matches the files feature

function ServiceCallSheet({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (f.size > MAX_MEDIA_BYTES) {
        toastError(`הקובץ ${f.name} גדול מדי (עד 50MB).`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
  }

  async function submit() {
    const t = title.trim();
    if (!t) return toastError(gendered(profile?.gender, "תן כותרת לקריאה.", "תני כותרת לקריאה."));
    setBusy(true);
    try {
      const attachments: ServiceCallAttachment[] = [];
      for (const f of files) {
        const path = await uploadServiceCallMedia(projectId, f);
        attachments.push({ path, mime: f.type || null, name: f.name });
      }
      const { error } = await openServiceCall(projectId, t, desc.trim(), attachments);
      if (error) throw error;
      // Best-effort email nudge to the studio (same as a new chat message).
      void notifyAdminTask("קריאת שירות חדשה", `${projectName}: ${t}`);
      setTitle("");
      setDesc("");
      setFiles([]);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["service-calls", projectId] });
      qc.invalidateQueries({ queryKey: ["service-summary", projectId] });
      toast({ title: "הקריאה נפתחה, נחזור אליך בהקדם", variant: "success" });
    } catch {
      toastError("פתיחת הקריאה נכשלה, נסו שוב בעוד רגע.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="shrink-0">
          <LifeBuoy className="size-4" /> פתיחת קריאת שירות
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>פתיחת קריאת שירות</SheetTitle>
          <SheetDescription>
            {gendered(
              profile?.gender,
              "ספר לנו מה צריך והקריאה תגיע ישר לסטודיו. נטפל בהקדם לפי זמן התגובה של החבילה שלך.",
              "ספרי לנו מה צריך והקריאה תגיע ישר לסטודיו. נטפל בהקדם לפי זמן התגובה של החבילה שלך.",
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sc-title">כותרת</Label>
            <Input
              id="sc-title"
              autoFocus
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: הטופס בעמוד צור קשר לא שולח"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-desc">תיאור (רשות)</Label>
            <Textarea
              id="sc-desc"
              rows={5}
              maxLength={4000}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={gendered(
                profile?.gender,
                "פרט מה קורה, מתי זה קרה, ובאיזה עמוד.",
                "פרטי מה קורה, מתי זה קרה, ובאיזה עמוד.",
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>צירוף תמונה או סרטון (רשות)</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-3 py-3 text-sm text-muted-foreground hover:text-foreground">
              <Paperclip className="size-4" />
              {gendered(profile?.gender, "בחר קובץ…", "בחרי קובץ…")}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 text-xs">
                    <span className="truncate text-foreground">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="הסרה"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "שולח…" : "שליחת הקריאה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- client's own service calls (status) ---------- */
function ServiceCallsList({ projectId }: { projectId: string }) {
  const { data: calls = [] } = useServiceCalls(projectId);
  if (!calls.length) return null;
  const tone: Record<ServiceCallStatus, string> = {
    new: "bg-brand-cyan-base/10 text-brand-cyan-base",
    scheduled: "bg-brand-cyan-base/10 text-brand-cyan-base",
    in_progress: "bg-primary/15 text-primary",
    done: "bg-primary/15 text-primary",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
        <LifeBuoy className="size-5 text-primary" /> הקריאות שלך
      </h3>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
        {calls.slice(0, 10).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-foreground">{c.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                {c.created_by && c.created_by !== c.client_id && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    נפתח ע״י הסטודיו
                  </span>
                )}
              </span>
            </span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", tone[c.status])}>
              {SC_STATUS_HE[c.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- one project's service board ---------- */
export function ServiceBoard({
  svc,
  projectName,
  preview,
  readOnly,
}: {
  svc: ProjectService;
  projectName: string;
  /** When provided, render from this snapshot instead of live queries (public preview). */
  preview?: { metrics: SiteMetric[]; log: MaintenanceLog[]; summary: ServiceSummary | null };
  readOnly?: boolean;
}) {
  const meta = TIER_META[svc.tier];
  const caps = useMyCapabilities(readOnly ? null : svc.project_id);
  // preview is always paired with readOnly (public snapshot) -> show money, source
  // from the snapshot's svc. Live client -> only finance members see money, sourced
  // from the finance-gated client_service_money RPC.
  const showMoney = preview || readOnly || caps.finance;
  // Money (price/rate) lives in the finance-gated project_service_money table and
  // is fetched only for a live finance member via the client_service_money RPC.
  // In readOnly/preview mode there is no member context, so it falls back to the
  // tier's list price (meta.price) — the public snapshot never carried real money.
  const { data: money } = useServiceMoney(readOnly ? null : svc.project_id, showMoney && !readOnly);
  const monthlyPrice = money?.monthly_price ?? null;
  const hourlyRate = money?.hourly_rate ?? null;
  const price = Number(monthlyPrice ?? meta.price);
  const wp = svc.site_type === "wordpress";
  // Show what THIS client actually signed (frozen agreement) so later edits to
  // the plans editor never change what an existing client already has. Fall back
  // to the live/code feature list when there is no agreement for this project.
  const { data: myAgreements = [] } = useMyAgreements();
  const agreement = preview ? undefined : myAgreements.find((a) => a.project_id === svc.project_id);
  const frozenFeatures = (agreement?.terms_snapshot as { features?: string[] } | null)?.features;
  const planCardFeatures = frozenFeatures?.length ? frozenFeatures : tierFeatures(svc.tier, svc.site_type);
  // In preview mode disable the live (RLS-gated) queries and use the snapshot.
  const pid = preview ? null : svc.project_id;
  const { data: liveMetrics = [] } = useSiteMetrics(pid, 30);
  const { data: liveLog = [] } = useMaintenanceLog(pid, 40);
  const { data: liveSummary } = useServiceSummary(pid);
  const metrics = preview?.metrics ?? liveMetrics;
  const log = preview?.log ?? liveLog;
  const summary = preview?.summary ?? liveSummary;

  const latest = metrics[0];
  const traffic7 = useMemo(() => metrics.slice(0, 7).reverse().map((m) => m.visitors ?? 0), [metrics]);
  const hasTraffic = traffic7.some((v) => v > 0);

  // Tier gate (per Ori): core = performance + uptime + backups only; pro adds
  // Turnstile (bot protection), threats/firewall and traffic/requests; ultra
  // includes everything pro has.
  const showSecurity = svc.tier === "pro" || svc.tier === "ultra";
  const showTraffic = svc.tier === "pro" || svc.tier === "ultra";

  // site_metrics has no per-day backup count column, so derive a small
  // zero-filled daily series straight from the maintenance log the page
  // already loads (kind === "backup"), last 14 days. Never a fake value: if
  // the log has no backup entries in range the chart is simply skipped.
  const backupSeries = useMemo(() => {
    const days = 14;
    const buckets = new Array(days).fill(0) as number[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const m of log) {
      if (m.kind !== "backup") continue;
      const d = new Date(m.occurred_at);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += m.count ?? 1;
    }
    return buckets;
  }, [log]);
  const hasBackupHistory = backupSeries.some((v) => v > 0);

  // Health ring color + label must match the score, never green-on-bad.
  const ps = latest?.pagespeed ?? null;
  const healthColor = ps == null ? GREEN : ps >= 90 ? GREEN : ps >= 50 ? "#F5A623" : "#F22C61";
  const healthWord = ps == null ? "" : ps >= 90 ? "מצוין" : ps >= 70 ? "טוב" : ps >= 50 ? "סביר" : "דורש שיפור";

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
              {showMoney && (
                <span className="text-muted-foreground">
                  <b className="font-heading text-lg text-foreground">₪{price.toLocaleString("he-IL")}</b> / חודש
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-full bg-brand-cyan-base/10 px-3 py-1 text-xs text-brand-cyan-base">
                <Clock className="size-3.5" /> תגובה עד {meta.responseHours} שעות
              </span>
              <span className="text-xs text-muted-foreground">חיוב הבא: {nextBilling}</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            {latest?.pagespeed != null && (
              <div className="flex flex-col items-center">
                <Ring value={latest.pagespeed} color={healthColor} label="בריאות" />
                <p className="mt-1 text-xs text-muted-foreground">ציון בריאות{healthWord ? ` · ${healthWord}` : ""}</p>
              </div>
            )}
            {!readOnly && caps.service_calls && <ServiceCallSheet projectId={svc.project_id} projectName={projectName} />}
          </div>
        </div>

        <div className="relative mt-6 grid gap-2 border-t border-border/60 pt-5 sm:grid-cols-2">
          {planCardFeatures.map((f) => (
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
          {showSecurity && (
            <Metric
              icon={ShieldCheck}
              label="איומים שנחסמו"
              value={latest?.threats_blocked != null ? String(latest.threats_blocked) : "בקרוב"}
              sub={wp ? "Malware + Firewall" : "Cloudflare Firewall"}
            />
          )}
          {showSecurity && (
            <Metric
              icon={Bot}
              label="חסימות בוטים"
              value={latest?.turnstile_blocked != null ? String(latest.turnstile_blocked) : "בקרוב"}
              sub="הגנת Cloudflare Turnstile"
              tone="cyan"
            />
          )}
          <Metric
            icon={TrendingUp}
            label="זמינות (Uptime)"
            value={latest?.uptime_pct != null ? `${latest.uptime_pct}%` : "בקרוב"}
            sub="30 יום אחרונים"
            tone="cyan"
          />
          {showTraffic && (
            <Metric
              icon={Globe}
              label="בקשות (Requests)"
              value={latest?.requests != null ? latest.requests.toLocaleString("he-IL") : "בקרוב"}
              sub="Cloudflare, 24 שעות אחרונות"
            />
          )}
          {showTraffic && (
            <Metric
              icon={GaugeIcon}
              label="יחס קאש (Cache Hit)"
              value={
                latest?.requests
                  ? `${Math.round((100 * (latest.cached_requests ?? 0)) / latest.requests)}%`
                  : "בקרוב"
              }
              sub="בקשות שהוגשו מהקאש"
              tone="cyan"
            />
          )}
          {(meta.hours > 0 || (summary?.hours_month ?? 0) > 0) && (
            <Metric
              icon={Clock}
              label="שעות שנוצלו"
              value={
                meta.hours > 0
                  ? `${hoursLabel(summary?.hours_month ?? 0)} / ${meta.hours}`
                  : hoursLabel(summary?.hours_month ?? 0)
              }
              sub={
                showMoney && hourlyRate
                  ? `שווי ₪${Math.round(roundH(summary?.hours_month ?? 0) * Number(hourlyRate)).toLocaleString("he-IL")}`
                  : "ייעוץ ופיתוח"
              }
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
        {hasBackupHistory && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">גיבויים לאורך זמן</p>
              <span className="text-xs text-muted-foreground">14 ימים אחרונים</span>
            </div>
            <Spark data={backupSeries} color={CYAN} />
          </div>
        )}
      </div>

      {/* site performance */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <GaugeIcon className="size-5 text-brand-cyan-base" /> ביצועי האתר
          </h3>
          {latest?.updated_at && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="size-3.5" /> עודכן לאחרונה: {fmtUpdated(latest.updated_at)}
            </span>
          )}
        </div>
        {!latest ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            נתוני הביצועים (תנועה, מהירות, זמינות) יתחילו להופיע כאן ברגע שהניטור יופעל לאתר שלך.
          </div>
        ) : (
          <div className="space-y-3">
            {/* speed over time */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">מגמת מהירות (PageSpeed)</p>
                <span className="text-xs text-muted-foreground">{metrics.length} ימים אחרונים</span>
              </div>
              <PerfChart metrics={metrics} field="pagespeed" color={GREEN} name="PageSpeed" domain={[0, 100]} />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">תנועה לאורך זמן</p>
                  <span className="text-xs text-muted-foreground">
                    <b className="text-foreground">{totalVisitors.toLocaleString("he-IL")}</b> מבקרים ·{" "}
                    <b className="text-foreground">{totalViews.toLocaleString("he-IL")}</b> צפיות
                  </span>
                </div>
                {hasTraffic ? (
                  <PerfChart metrics={metrics} field="visitors" color={CYAN} name="מבקרים" height={150} />
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">נתוני תנועה יופיעו בקרוב.</p>
                )}
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4">
                {latest.pagespeed != null ? (
                  <>
                    <Ring value={latest.pagespeed} color={CYAN} label="עכשיו" />
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
          </div>
        )}
      </div>

      {/* security & bot protection (Cloudflare) */}
      {showSecurity && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" /> אבטחה והגנה מבוטים
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">חסימות בוטים (Turnstile)</p>
                <span className="text-xs text-muted-foreground">{metrics.length} ימים אחרונים</span>
              </div>
              <PerfChart metrics={metrics} field="turnstile_blocked" color={GREEN} name="חסימות בוטים" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">איומים שנחסמו</p>
                <span className="text-xs text-muted-foreground">{metrics.length} ימים אחרונים</span>
              </div>
              <PerfChart metrics={metrics} field="threats_blocked" color={GREEN} name="איומים שנחסמו" />
            </div>
          </div>
        </div>
      )}

      {/* traffic & requests (Cloudflare) */}
      {showTraffic && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Globe className="size-5 text-brand-cyan-base" /> תנועה ובקשות (Cloudflare)
          </h3>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">בקשות לאורך זמן</p>
              <span className="text-xs text-muted-foreground">{metrics.length} ימים אחרונים</span>
            </div>
            <PerfChart metrics={metrics} field="requests" color={CYAN} name="בקשות" />
          </div>
        </div>
      )}

      {/* cumulative value */}
      {showMoney && (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Sparkles className="size-5 text-primary" /> הערך שקיבלת מאיתנו
        </h3>
        <div className={cn("grid grid-cols-2 gap-4", showSecurity ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{summary?.updates_total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{wp ? "עדכונים" : "פריסות"}</p>
          </div>
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{summary?.backups_total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">גיבויים</p>
          </div>
          {showSecurity && (
            <div className="text-center">
              <p className="font-heading text-2xl font-black text-primary">{summary?.threats_total ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">איומים נחסמו</p>
            </div>
          )}
          <div className="text-center">
            <p className="font-heading text-2xl font-black text-primary">{hoursLabel(summary?.hours_total ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">שעות עבודה</p>
          </div>
        </div>
        {(() => {
          const val = packageValue(svc.tier, svc.site_type, hourlyRate != null ? Number(hourlyRate) : null);
          const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
          const rows: { l: string; v: string }[] = [];
          // Value of the work delivered: actual hours this month × rate, falling
          // back to the plan's included hours when nothing was logged yet.
          const rate = hourlyRate != null ? Number(hourlyRate) : 0;
          const hoursMonth = summary?.hours_month ?? 0;
          const workHours = hoursMonth > 0 ? hoursMonth : val.hours;
          const workShekel = Math.round(roundH(workHours) * rate);
          if (workShekel > 0)
            rows.push({
              l: `${hoursLabel(workHours)} שעות עבודה / ייעוץ ${hoursMonth > 0 ? "החודש" : "בחודש"}`,
              v: shekel(workShekel),
            });
          if (val.licenseAnnual > 0)
            rows.push({ l: "רישיונות פרימיום (Elementor + Crocoblock)", v: `${shekel(val.licenseAnnual)} / שנה` });
          rows.push({ l: "אחסון פרימיום, CDN וניטור 24/7", v: "כלול" });
          rows.push({ l: "גיבויים אוטומטיים ואבטחה בקצה", v: "כלול" });
          return (
            <div className="mt-4 rounded-xl bg-card/60 p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">מה כלול במחיר החבילה</p>
              <div className="divide-y divide-border/60">
                {rows.map((r) => (
                  <div key={r.l} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-muted-foreground">{r.l}</span>
                    <span className="tabular-nums text-foreground">{r.v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {workShekel > 0 && val.licenseAnnual > 0 ? (
                  <>
                    רק העבודה החודש (<b className="text-primary">{shekel(workShekel)}</b>) והרישיונות (
                    <b className="text-primary">{shekel(val.licenseAnnual)}</b> לשנה) שווים יותר מהמחיר, והכול כלול ב-
                    <b className="text-foreground">{shekel(price)}</b> לחודש, בלי הפתעות.
                  </>
                ) : workShekel > 0 ? (
                  <>
                    רק שעות העבודה החודש שוות <b className="text-primary">{shekel(workShekel)}</b>, וכלולות יחד עם אחסון,
                    CDN וניטור ב-<b className="text-foreground">{shekel(price)}</b> לחודש, בלי הפתעות.
                  </>
                ) : val.licenseAnnual > 0 ? (
                  <>
                    רק הרישיונות חוסכים לך <b className="text-primary">{shekel(val.licenseAnnual)}</b> בשנה, והכול כלול
                    ב-<b className="text-foreground">{shekel(price)}</b> לחודש, בלי הפתעות.
                  </>
                ) : (
                  <>
                    אחסון, CDN, ניטור ופיתוח שוטף , הכול כלול ב-<b className="text-foreground">{shekel(price)}</b> לחודש.
                  </>
                )}
              </p>
            </div>
          );
        })()}
      </div>
      )}

      {/* client's own service calls */}
      {!readOnly && <ServiceCallsList projectId={svc.project_id} />}

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

const STUDIO_WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;

/* ---------- upsell teaser (no package yet) ---------- */
/** A realistic, blurred mock of the full service dashboard, sitting behind the CTA. */
function TeaserBackdrop() {
  const demoFeatures = [
    "אחסון פרימיום, עדכונים וגיבויים בטוחים",
    "חבילת רישיונות בשווי ₪1,172 (Elementor, Crocoblock)",
    "הגנה היקפית וגיבויים אוטומטיים",
    "דו״ח פעילות וביצועים חודשי",
    "מאיץ מהירות ו-CDN (Cloudflare)",
    "עד 3 שעות עבודה / ייעוץ בחודש",
  ];
  return (
    <div aria-hidden className="pointer-events-none select-none space-y-6 opacity-80 blur-[6px]">
      {/* plan hero */}
      <div className="rounded-3xl border border-primary/30 bg-card p-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className="flex gap-2">
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                החבילה שלך
              </span>
              <span className="rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                אתר WordPress
              </span>
            </div>
            <h3 className="mt-3 font-heading text-3xl font-black text-foreground">Studio Pro</h3>
            <p className="text-sm text-muted-foreground">ביצוע פרימיום · האתר שלך</p>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                <b className="font-heading text-lg text-foreground">₪800</b> / חודש
              </span>
              <span className="rounded-full bg-brand-cyan-base/10 px-3 py-1 text-xs text-brand-cyan-base">תגובה עד 24 שעות</span>
            </div>
          </div>
          <Ring value={94} color={GREEN} label="בריאות" />
        </div>
        <div className="mt-6 grid gap-2 border-t border-border/60 pt-5 sm:grid-cols-2">
          {demoFeatures.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* what we did this month */}
      <div>
        <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">מה עשינו החודש</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric icon={RefreshCw} label="עדכונים שבוצעו" value="12" sub="ליבה + תוספים" />
          <Metric icon={DatabaseBackup} label="גיבויים" value="30" sub="החודש" tone="cyan" />
          <Metric icon={ShieldCheck} label="איומים שנחסמו" value="1,830" sub="Malware + Firewall" />
          <Metric icon={TrendingUp} label="זמינות" value="99.9%" sub="30 יום אחרונים" tone="cyan" />
          <Metric icon={Clock} label="שעות שנוצלו" value="2.4 / 3" sub="שווי ₪720" />
          <Metric icon={Zap} label="קריאות שירות" value="2" sub="החודש" tone="cyan" />
        </div>
      </div>

      {/* performance */}
      <div>
        <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">ביצועי האתר</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
            <p className="mb-2 text-sm font-semibold text-foreground">תנועה, 7 ימים אחרונים</p>
            <Spark data={[120, 180, 150, 210, 190, 240, 194]} color={CYAN} />
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4">
            <Ring value={96} color={CYAN} label="PageSpeed" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceTeaser() {
  const { profile } = useAuth();
  const waHref = STUDIO_WHATSAPP
    ? `https://wa.me/${String(STUDIO_WHATSAPP).replace(/\D/g, "")}?text=${encodeURIComponent(
        "היי אורי, אשמח לשמוע על חבילת התחזוקה לאתר שלי",
      )}`
    : undefined;
  const benefits = [
    "ניטור, אבטחה וגיבויים אוטומטיים 24/7",
    "עדכונים שוטפים ושעות פיתוח כלולות",
    "דו״ח ביצועים חודשי, שקוף ומלא",
    "קריאת שירות בלחיצה, עם זמן תגובה מובטח",
  ];
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-primary/30 bg-card">
      <div className="p-4 sm:p-6">
        <TeaserBackdrop />
      </div>

      {/* crisp overlay */}
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-background/60 via-background/80 to-background/95 p-4">
        <div className="w-full max-w-lg rounded-3xl border border-border/70 bg-card/80 p-6 text-center shadow-2xl backdrop-blur-sm sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
            תצוגה לדוגמה
          </span>
          <h2 className="mt-4 font-heading text-2xl font-black leading-tight text-foreground sm:text-3xl">
            ככה ייראה האתר שלך
            <br />
            תחת חבילת תחזוקה
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {gendered(
              profile?.gender,
              "האתר באוויר, ומכאן אנחנו שומרים עליו מהיר, מאובטח ומעודכן, בלי שתצטרך לגעת בכלום.",
              "האתר באוויר, ומכאן אנחנו שומרים עליו מהיר, מאובטח ומעודכן, בלי שתצטרכי לגעת בכלום.",
            )}
          </p>
          <ul className="mx-auto mt-5 grid max-w-md gap-2.5 text-start sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {waHref && (
            <div className="mt-6 flex justify-center">
              <FancyButton label="דברו איתי על חבילת תחזוקה" href={waHref} target="_blank" rel="noreferrer noopener" />
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">בלי התחייבות, נבנה יחד את מה שנכון לאתר שלך.</p>
        </div>
      </div>
    </div>
  );
}

export default function Service() {
  const { data: allServices = [], isLoading } = useMyServices();
  const { data: projects = [] } = useProjects();
  const [activeId, setActiveId] = useState<string | undefined>();

  // A linked (child) project has no package of its own, its work rolls up into
  // the parent's retainer. Show only top-level projects' packages here.
  const isChild = (id: string) => !!projects.find((x) => x.id === id)?.parent_project_id;
  const services = allServices.filter((s) => !isChild(s.project_id));

  const projName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? p.business_name || p.title : "האתר שלך";
  };
  // The switcher must distinguish projects, and a client's projects share one
  // business_name — so use the project title there (and on the agreements).
  const projTitle = (id: string) => projects.find((x) => x.id === id)?.title ?? "פרויקט";

  const current = services.find((s) => s.project_id === activeId) ?? services[0];
  const caps = useMyCapabilities(current?.project_id ?? null);

  return (
    <div>
      <PageHeader
        title="השירות שלך"
        subtitle="השותף הטכנולוגי שדואג שהאתר שלך יהיה מהיר, מאובטח ומעודכן, כל הזמן."
      />

      {isLoading ? (
        <CenteredLoader label="טוען…" />
      ) : !current ? (
        projects.some((p) => p.status === "active" || p.status === "completed") ? (
          <ServiceTeaser />
        ) : (
          <EmptyState
            icon={HeartHandshake}
            title="אין חבילת שירות פעילה"
            description="עדיין לא משויכת אליך חבילת ליווי ותחזוקה. דבר איתנו כדי לשמור על האתר מהיר ומאובטח."
          />
        )
      ) : (
        <div className="space-y-4">
          {services.length > 1 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">בחירת פרויקט</p>
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
                    {projTitle(s.project_id)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ServiceBoard svc={current} projectName={projName(current.project_id)} />
          {/* Agreements for the project currently in view (switches with the tabs). */}
          {caps.finance && (
            <MyAgreements projects={projects} projectId={current.project_id} projectName={projTitle(current.project_id)} />
          )}
        </div>
      )}

      {/* No active package: still let the client see any signed documents. */}
      {!current && !isLoading && <MyAgreements projects={projects} />}
    </div>
  );
}

/** The current client's signed service agreements, with a link to each frozen
 * document. Renders nothing when there are none. */
function MyAgreements({
  projects,
  projectId,
  projectName,
}: {
  projects: { id: string; title: string }[];
  projectId?: string;
  projectName?: string;
}) {
  const { data: allAgreements = [] } = useMyAgreements();
  // When viewing a specific project, show only that project's agreements so the
  // documents match the dashboard above. Without a project (no active package),
  // show everything so the client can still reach any signed document.
  const agreements = projectId ? allAgreements.filter((a) => a.project_id === projectId) : allAgreements;
  if (!agreements.length) return null;
  const projTitle = (id: string | null) => projects.find((p) => p.id === id)?.title ?? null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
        <FileText className="size-5 text-muted-foreground" /> אישורי השירות שלך
        {projectName ? <span className="text-sm font-normal text-muted-foreground">· {projectName}</span> : null}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">האישורים החתומים שלך. אפשר לצפות ולהוריד בכל עת.</p>
      <ul className="mt-4 space-y-2">
        {agreements.map((a) => {
          const snap = (a.terms_snapshot ?? {}) as { tier_name?: string };
          const annual = a.billing_cycle === "annual";
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {snap.tier_name || a.tier}
                  <span className="mr-2 text-muted-foreground">
                    ₪{Number(a.monthly_price ?? 0).toLocaleString("he-IL")} / חודש · {annual ? "שנתי" : "חודשי"}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {projTitle(a.project_id) ? `${projTitle(a.project_id)} · ` : ""}
                  {new Date(a.created_at).toLocaleDateString("he-IL")}
                  {a.signature_image ? " · חתום ✓" : ""}
                </p>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <a href={`/l/agreement/${a.access_token}`} target="_blank" rel="noreferrer">
                  <FileText className="ml-1.5 size-4" /> צפייה במסמך
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
