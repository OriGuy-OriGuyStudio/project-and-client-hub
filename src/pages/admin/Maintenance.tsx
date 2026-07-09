import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, RefreshCw, ExternalLink, LifeBuoy, Gauge, ShieldCheck, Clock, Link2, Copy, Sparkles, LineChart, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { isDemoEmail } from "@/lib/demo";
import { TIER_META } from "@/lib/service-plans";
import { useMaintenanceOverview, refreshSiteMetrics, siteInsights, sendReport, useSiteMetrics, type MaintenanceOverviewRow, type SiteInsights } from "@/hooks/useService";
import { PerfChart } from "@/components/service/PerfChart";

const GREEN = "#B4D670";
const CYAN = "#77BECF";

/** Big per-site performance window: trends over time + a recent-days table. */
function PerformanceSheet({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [open, setOpen] = useState(false);
  const { data: metrics = [] } = useSiteMetrics(open ? projectId : null, 60);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="secondary">
          <LineChart className="size-3.5" /> ביצועים
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>ביצועים · {projectTitle}</SheetTitle>
          <SheetDescription>מגמות ומדדים לאורך זמן (עד 60 יום), מעבר לסעיפי התחזוקה.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-sm font-semibold text-foreground">מהירות (PageSpeed)</p>
            <PerfChart metrics={metrics} field="pagespeed" color={GREEN} name="PageSpeed" domain={[0, 100]} />
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-foreground">זמינות</p>
            <PerfChart metrics={metrics} field="uptime_pct" color={GREEN} name="זמינות" unit="%" domain={[95, 100]} height={140} />
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-foreground">מבקרים</p>
            <PerfChart metrics={metrics} field="visitors" color={CYAN} name="מבקרים" height={140} />
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-foreground">איומים שנחסמו</p>
            <PerfChart metrics={metrics} field="threats_blocked" color={CYAN} name="איומים" height={140} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">ימים אחרונים</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    {["תאריך", "מהירות", "LCP", "זמינות", "מבקרים", "איומים"].map((h) => (
                      <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {metrics.slice(0, 14).map((m) => (
                    <tr key={m.id} className="text-foreground">
                      <td className="px-3 py-1.5">{new Date(`${m.metric_date}T00:00:00`).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.pagespeed ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.lcp_ms != null ? `${(m.lcp_ms / 1000).toFixed(1)}s` : "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.uptime_pct != null ? `${m.uptime_pct}%` : "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.visitors ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.threats_blocked ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** AI review (Gemini) of a site: diagnosis + concrete recommendations. */
function InsightsSheet({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SiteInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setData(null);
    const res = await siteInsights(projectId);
    setLoading(false);
    if (res.error) setErr(res.error);
    else setData(res.data);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o && !data && !loading) run(); }}>
      <SheetTrigger asChild>
        <Button size="sm" variant="secondary">
          <Sparkles className="size-3.5" /> תובנות AI
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>תובנות AI · {projectTitle}</SheetTitle>
          <SheetDescription>אבחון והמלצות שיפור על סמך המדדים ותוכן העמוד. סקירה, לא תחליף לשיקול דעת.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="py-10">
              <CenteredLoader label="מנתח את האתר…" />
            </div>
          ) : err ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>
          ) : data ? (
            <>
              <p className="text-sm leading-relaxed text-foreground">{data.assessment}</p>
              <div className="space-y-2">
                {data.recommendations.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-background/40 p-3">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{r.area}</span>
                    <p className="mt-1.5 text-sm text-foreground">{r.text}</p>
                  </div>
                ))}
              </div>
              {data.fetchedPage === false && (
                <p className="text-xs text-muted-foreground">לא הצלחתי לקרוא את תוכן העמוד, ההמלצות מבוססות על המדדים בלבד.</p>
              )}
              <Button size="sm" variant="ghost" onClick={run}>
                <RefreshCw className="size-3.5" /> נתח שוב
              </Button>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const hoursLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A metric chip that turns amber/red when the value looks off. */
function Stat({ icon: Icon, label, value, tone = "ok" }: { icon: typeof Gauge; label: string; value: string; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const color =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : tone === "muted" ? "text-muted-foreground" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className={cn("font-heading text-lg font-bold tabular-nums", color)}>{value}</p>
    </div>
  );
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`).getTime();
  return Math.floor((Date.now() - d) / 86400000);
}

function PackageCard({ row }: { row: MaintenanceOverviewRow }) {
  const qc = useQueryClient();
  const [copying, setCopying] = useState(false);
  const [sending, setSending] = useState(false);
  const meta = TIER_META[row.tier];
  const includedHours = meta.hours;
  const staleDays = daysSince(row.last_metric_date);

  const psTone = row.pagespeed == null ? "muted" : row.pagespeed < 50 ? "bad" : row.pagespeed < 90 ? "warn" : "ok";
  const upTone = row.uptime_pct == null ? "muted" : Number(row.uptime_pct) < 99 ? "bad" : Number(row.uptime_pct) < 99.9 ? "warn" : "ok";
  const hoursTone = includedHours > 0 && row.hours_month > includedHours ? "warn" : "ok";
  const stale = staleDays != null && staleDays > 2;
  const anomaly = psTone === "bad" || upTone === "bad" || hoursTone === "warn" || row.open_calls > 0 || stale;

  async function copyPreview() {
    setCopying(true);
    let token = row.preview_token;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase.from("project_service").update({ preview_token: token }).eq("project_id", row.project_id);
      if (error) {
        setCopying(false);
        return toastError("יצירת הקישור נכשלה.");
      }
      qc.invalidateQueries({ queryKey: ["maintenance-overview"] });
    }
    const url = `${window.location.origin}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "הקישור הועתק ✓", variant: "success" });
    } catch {
      toastError(url);
    }
    setCopying(false);
  }

  async function sendClientReport() {
    if (!window.confirm("לשלוח ללקוח את הדוח החודשי במייל?")) return;
    setSending(true);
    const { error } = await sendReport(row.project_id);
    setSending(false);
    if (error) return toastError(error);
    toast({ title: "הדוח נשלח ללקוח ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["maintenance-overview"] });
  }

  return (
    <Card className={cn("p-4", anomaly && "border-amber-500/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-base font-semibold text-foreground">{row.project_title}</span>
            <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">{meta.label}</span>
            {row.open_calls > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <LifeBuoy className="size-3" /> {row.open_calls} קריאות פתוחות
              </span>
            )}
            {stale && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                ניטור לא עודכן {staleDays} ימים
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.client_name}
            {row.site_url && (
              <>
                {" · "}
                <a href={row.site_url} target="_blank" rel="noreferrer noopener" className="hover:text-foreground">
                  {row.site_url.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button size="sm" onClick={sendClientReport} disabled={sending}>
            <Mail className="size-3.5" /> שלח דוח ללקוח
          </Button>
          <PerformanceSheet projectId={row.project_id} projectTitle={row.project_title} />
          <InsightsSheet projectId={row.project_id} projectTitle={row.project_title} />
          {isDemoEmail(row.client_email) && (
            <Button size="sm" variant="secondary" onClick={copyPreview} disabled={copying}>
              <Copy className="size-3.5" /> העתק קישור תצוגה
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link to={`/projects/${row.project_id}`}>
              פרויקט <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Gauge} label="PageSpeed" value={row.pagespeed != null ? String(row.pagespeed) : "—"} tone={psTone} />
        <Stat icon={ShieldCheck} label="זמינות" value={row.uptime_pct != null ? `${row.uptime_pct}%` : "—"} tone={upTone} />
        <Stat icon={ShieldCheck} label="איומים נחסמו" value={row.threats_blocked != null ? String(row.threats_blocked) : "—"} tone="muted" />
        <Stat
          icon={Clock}
          label="שעות החודש"
          value={includedHours > 0 ? `${hoursLabel(row.hours_month)} / ${includedHours}` : hoursLabel(row.hours_month)}
          tone={hoursTone}
        />
      </div>
    </Card>
  );
}

export default function Maintenance() {
  const { data: rows = [], isLoading } = useMaintenanceOverview();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    const { error } = await refreshSiteMetrics();
    setRefreshing(false);
    if (error) return toastError("הרענון נכשל, נסה שוב.");
    qc.invalidateQueries({ queryKey: ["maintenance-overview"] });
    toast({ title: "הנתונים רועננו ✓", variant: "success" });
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <PageHeader title="חבילות תחזוקה" subtitle="כל החבילות הפעילות והביצועים שלהן, כדי לזהות חריגות ולהיות יוזם מול הלקוחות." />
        <div className="pt-1">
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> רענן נתונים עכשיו
          </Button>
        </div>
      </div>

      {isLoading ? (
        <CenteredLoader label="טוען…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="אין חבילות תחזוקה פעילות"
          description="כשתשייך חבילת שירות ללקוח (עם כתובת אתר), היא תופיע כאן והניטור היומי יתחיל אוטומטית."
        />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="size-3.5" /> הניטור היומי (PageSpeed) רץ אוטומטית לכל חבילה עם כתובת אתר. אין צורך בהגדרה נוספת.
          </p>
          {rows.map((r) => (
            <PackageCard key={r.project_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
