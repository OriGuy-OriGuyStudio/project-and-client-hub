import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Timer,
  Download,
  FolderKanban,
  User,
  ChevronDown,
  Link2,
  Play,
  Pencil,
  Building2,
  FlaskConical,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { timer, ctxFromSession } from "@/lib/timer-store";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { isInternalClient } from "@/lib/internal";
import { isDemoEmail } from "@/lib/demo";
import { clientLabel } from "@/components/timer/timer-controls";
import { useTimeSessions } from "@/hooks/useTimeData";
import { TimerBoard } from "@/components/timer/TimerBoard";
import { SessionNote } from "@/components/timer/SessionNote";
import { SessionEditorSheet } from "@/components/timer/SessionEditorSheet";
import type { TimeSession } from "@/types/database";

const DAY = 86400000;
function hms(s: number) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${h}:${p(m)}:${p(ss)}`;
}
const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

function dayLabel(ms: number) {
  const today = new Date().setHours(0, 0, 0, 0);
  if (ms === today) return "היום";
  if (ms === today - DAY) return "אתמול";
  return new Date(ms).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}
function groupByDay<T extends { started_at: string; duration_seconds: number }>(sessions: T[]) {
  const map = new Map<number, { ms: number; total: number; items: T[] }>();
  for (const s of sessions) {
    const d = new Date(s.started_at);
    const ms = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const g = map.get(ms) ?? { ms, total: 0, items: [] };
    g.total += s.duration_seconds;
    g.items.push(s);
    map.set(ms, g);
  }
  return [...map.values()].sort((a, b) => b.ms - a.ms);
}

type Tab = "timer" | "reports";

export default function TimeReports() {
  const [tab, setTab] = useState<Tab>("timer");

  return (
    <div>
      <PageHeader
        title="מעקב זמן"
        subtitle="הפעל טיימר לפי לקוח, פרויקט ושלב, וצפה בסיכום הזמן וב-₪ לשעה. אדמין בלבד."
      />

      <div className="mb-6 inline-flex gap-1 rounded-full border border-border/60 bg-card/60 p-1">
        {[
          { id: "timer" as Tab, label: "טיימר" },
          { id: "reports" as Tab, label: "דוחות" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t.id
                ? "bg-primary text-[color:var(--ink,#0a0623)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timer" ? <TimerBoard /> : <ReportsSection />}
    </div>
  );
}

/* ---------------- little building blocks ---------------- */
function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "task" | "pomo";
}) {
  const dot =
    tone === "task" ? "bg-primary" : tone === "pomo" ? "bg-brand-cyan-base" : "";
  const valueColor =
    tone === "task" ? "text-primary" : tone === "pomo" ? "text-brand-cyan-base" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot && <span className={cn("size-2 rounded-full", dot)} />}
        {label}
      </p>
      <p className={cn("mt-1 font-heading text-2xl font-bold tabular-nums", valueColor)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** A right-anchored proportional bar (RTL). */
function Bar({ frac, tone = "task" }: { frac: number; tone?: "task" | "pomo" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn("h-full rounded-full", tone === "task" ? "bg-primary" : "bg-brand-cyan-base")}
        style={{ width: `${Math.max(3, Math.round(frac * 100))}%` }}
      />
    </div>
  );
}

const DONUT_COLORS = ["#B4D670", "#77BECF", "#A78BFA", "#F0A868", "#EC6A9C", "#5EC7A0", "#E0C46B"];

/** Time-share donut (by client) with a legend. */
function Donut({ data, total }: { data: { client: string; sec: number }[]; total: number }) {
  const R = 58;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90 shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(246,244,244,.08)" strokeWidth="18" />
        {data.map((d, i) => {
          const len = total > 0 ? (d.sec / total) * C : 0;
          const seg = (
            <circle
              key={d.client}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="min-w-[160px] flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div key={d.client} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              <span className="truncate text-foreground">{d.client}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {hms(d.sec)} · {pct(d.sec, total)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- reports dashboard ---------------- */
type Range = "today" | "week" | "month" | "all" | "custom";

export function ReportsSection() {
  const { data: allSessions = [], isLoading } = useTimeSessions();
  const { data: projects = [] } = useProjects();
  const { data: clientsData } = useClients();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modeFilter, setModeFilter] = useState<"all" | "up" | "down">("all");
  const [range, setRange] = useState<Range>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [editing, setEditing] = useState<TimeSession | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // apply the date-range filter to everything the dashboard shows
  const sessions = useMemo(() => {
    if (range === "all") return allSessions;
    if (range === "custom") {
      const fromMs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : -Infinity;
      const toMs = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : Infinity;
      return allSessions.filter((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= fromMs && t <= toMs;
      });
    }
    const now = new Date();
    let from: number;
    if (range === "today") from = new Date().setHours(0, 0, 0, 0);
    else if (range === "week") from = Date.now() - 7 * DAY;
    else from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return allSessions.filter((s) => new Date(s.started_at).getTime() >= from);
  }, [allSessions, range, customFrom, customTo]);

  const { data: stages = [] } = useQuery({
    queryKey: ["all-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("project_stages").select("id, title, project_id");
      return data ?? [];
    },
  });
  const { data: billing = [] } = useQuery({
    queryKey: ["project-billing-all"],
    queryFn: async () => {
      const { data } = await supabase.from("project_billing").select("project_id, value");
      return data ?? [];
    },
  });

  const model = useMemo(() => {
    const projName = new Map(projects.map((p) => [p.id, p.business_name || p.title])); // client-facing name
    const projTitle = new Map(projects.map((p) => [p.id, p.title])); // the project's own title
    const projClientId = new Map(projects.map((p) => [p.id, p.client_id]));
    const clientName = new Map((clientsData?.active ?? []).map((c) => [c.id, clientLabel(c)]));
    const internalIds = new Set(
      (clientsData?.active ?? []).filter((c) => isInternalClient(c.email)).map((c) => c.id),
    );
    // Ori's demo/test accounts — kept out of the real-client analytics entirely.
    const demoIds = new Set(
      (clientsData?.active ?? []).filter((c) => isDemoEmail(c.email)).map((c) => c.id),
    );
    const clientOf = (id: string | null | undefined) => (id ? clientName.get(id) || "לקוח" : "לקוח");
    const stageName = new Map(stages.map((s) => [s.id, s.title]));
    const value = new Map(billing.map((b) => [b.project_id, b.value]));

    // buckets keyed by project id, or `noproj:<clientId>` for pre-project time
    const byProject = new Map<string, { total: number; clientId: string | null; stages: Map<string, number> }>();
    const personal = new Map<string, { sec: number; projectId: string | null }>();
    let total = 0;
    let week = 0;
    let today = 0;
    let taskTotal = 0;
    let pomoTotal = 0;
    const weekAgo = Date.now() - 7 * DAY;
    const dayStart = new Date().setHours(0, 0, 0, 0);

    for (const s of sessions) {
      total += s.duration_seconds;
      const startedMs = new Date(s.started_at).getTime();
      if (startedMs >= weekAgo) week += s.duration_seconds;
      if (startedMs >= dayStart) today += s.duration_seconds;
      if (s.mode === "down") pomoTotal += s.duration_seconds;
      else taskTotal += s.duration_seconds;

      if (s.kind === "personal") {
        const cur = personal.get(s.label || "אישי") ?? { sec: 0, projectId: null };
        cur.sec += s.duration_seconds;
        if (s.project_id) cur.projectId = s.project_id;
        personal.set(s.label || "אישי", cur);
      }

      const cid = s.client_id ?? (s.project_id ? projClientId.get(s.project_id) ?? null : null);
      if (s.project_id) {
        // stage sessions + personal labels linked to a project
        const p = byProject.get(s.project_id) ?? { total: 0, clientId: cid, stages: new Map() };
        p.total += s.duration_seconds;
        const key = s.stage_id ?? (s.kind === "personal" && s.label ? `label:${s.label}` : "—");
        p.stages.set(key, (p.stages.get(key) ?? 0) + s.duration_seconds);
        byProject.set(s.project_id, p);
      } else if (s.kind === "stage" && cid) {
        // pre-project time for a client (no project yet)
        const bk = `noproj:${cid}`;
        const p = byProject.get(bk) ?? { total: 0, clientId: cid, stages: new Map() };
        p.total += s.duration_seconds;
        p.stages.set("—", (p.stages.get("—") ?? 0) + s.duration_seconds);
        byProject.set(bk, p);
      }
    }

    // ready-to-render project rows, grouped under their client
    const projectRows = [...byProject.entries()]
      .map(([pid, agg]) => {
        const pre = pid.startsWith("noproj:");
        const internal = !!agg.clientId && internalIds.has(agg.clientId);
        const demo = !!agg.clientId && demoIds.has(agg.clientId);
        const val = pre || internal || demo ? 0 : Number(value.get(pid) ?? 0);
        return {
          id: pid,
          name: pre ? "טרם פרויקט" : projTitle.get(pid) || projName.get(pid) || "פרויקט",
          client: clientOf(agg.clientId),
          preProject: pre,
          internal,
          demo,
          total: agg.total,
          value: val,
          rate: val > 0 && agg.total > 0 ? val / (agg.total / 3600) : null,
          stages: [...agg.stages.entries()]
            .map(([sid, sec]) => ({
              name: sid.startsWith("label:") ? sid.slice(6) : sid === "—" ? "טרם פרויקט" : stageName.get(sid) || "ללא שלב",
              linked: sid.startsWith("label:"),
              sec,
            }))
            .sort((a, b) => b.sec - a.sec),
        };
      })
      .sort((a, b) => b.total - a.total);
    const maxProject = projectRows.reduce((m, r) => Math.max(m, r.total), 0) || 1;

    const clientGroups = new Map<string, typeof projectRows>();
    for (const r of projectRows) {
      const arr = clientGroups.get(r.client) ?? [];
      arr.push(r);
      clientGroups.set(r.client, arr);
    }

    const personalRows = [...personal.entries()]
      .map(([label, { sec, projectId }]) => ({
        label,
        sec,
        project: projectId ? projName.get(projectId) || null : null,
      }))
      .sort((a, b) => b.sec - a.sec);
    const maxPersonal = personalRows.reduce((m, r) => Math.max(m, r.sec), 0) || 1;

    // time share per PAYING client, for the donut (studio/internal + demo excluded)
    const clientTime = [...clientGroups.entries()]
      .filter(([, projs]) => !projs[0]?.internal && !projs[0]?.demo)
      .map(([client, projs]) => ({ client, sec: projs.reduce((a, p) => a + p.total, 0) }))
      .sort((a, b) => b.sec - a.sec);

    return {
      projName,
      projTitle,
      stageName,
      clientName,
      total,
      week,
      today,
      taskTotal,
      pomoTotal,
      projectRows,
      maxProject,
      clientGroups,
      clientTime,
      personalRows,
      maxPersonal,
    };
  }, [sessions, projects, stages, billing, clientsData]);

  // "today / this week" glance stays constant regardless of the range filter.
  // Today is split into paying-client work vs internal-studio work.
  const glance = useMemo(() => {
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const weekAgo = Date.now() - 7 * DAY;
    const internalIds = new Set(
      (clientsData?.active ?? []).filter((c) => isInternalClient(c.email)).map((c) => c.id),
    );
    const projClient = new Map(projects.map((p) => [p.id, p.client_id]));
    let today = 0;
    let week = 0;
    let todayStudio = 0;
    for (const s of allSessions) {
      const t = new Date(s.started_at).getTime();
      if (t >= dayStart) {
        today += s.duration_seconds;
        const cid = s.client_id ?? (s.project_id ? projClient.get(s.project_id) ?? null : null);
        if (cid && internalIds.has(cid)) todayStudio += s.duration_seconds;
      }
      if (t >= weekAgo) week += s.duration_seconds;
    }
    return { today, week, todayStudio, todayClients: today - todayStudio };
  }, [allSessions, clientsData, projects]);

  const continueSession = (s: TimeSession) =>
    timer.start(
      ctxFromSession(s, {
        project: (id) => model.projName.get(id) ?? null,
        stage: (id) => model.stageName.get(id) ?? null,
        client: (id) => model.clientName.get(id) ?? null,
      }),
      { mode: s.mode },
    );
  const openEdit = (s: TimeSession) => {
    setEditing(s);
    setEditorOpen(true);
  };

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows = [["תאריך", "סוג", "פרויקט/תווית", "לקוח", "שלב", "מצב", "משך (שניות)", "משך"]];
    for (const s of sessions) {
      const linkedProj = s.project_id ? model.projTitle.get(s.project_id) || "" : "";
      const clientNm = s.client_id ? model.clientName.get(s.client_id) || "" : "";
      rows.push([
        new Date(s.started_at).toLocaleString("he-IL"),
        s.kind === "personal" ? "אישי" : "פרויקט",
        s.kind === "personal" ? s.label || "" : linkedProj || clientNm,
        clientNm || linkedProj,
        s.stage_id ? model.stageName.get(s.stage_id) || "" : "",
        s.mode === "down" ? "פומודורו" : "משימה",
        String(s.duration_seconds),
        hms(s.duration_seconds),
      ]);
    }
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "time-sessions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <CenteredLoader label="טוען דוחות…" />;

  if (!allSessions.length) {
    return (
      <EmptyState
        icon={Timer}
        title="עדיין אין סשנים"
        description="עבור ללשונית ״טיימר״ ותתחיל למדוד זמן."
      />
    );
  }

  const taskPctVal = pct(model.taskTotal, model.total);
  const pomoPctVal = 100 - taskPctVal;
  const shownSessions = sessions.filter((s) => modeFilter === "all" || s.mode === modeFilter);
  const rangeLabels: Record<Range, string> = { today: "היום", week: "7 ימים", month: "החודש", all: "הכל", custom: "מותאם" };

  const groups = [...model.clientGroups.entries()];
  const payingGroups = groups.filter(([, p]) => !p[0]?.internal && !p[0]?.demo);
  const internalGroups = groups.filter(([, p]) => p[0]?.internal);
  const demoGroups = groups.filter(([, p]) => p[0]?.demo);

  const renderClientCard = (client: string, projs: typeof model.projectRows) => {
    const clientTotal = projs.reduce((a, p) => a + p.total, 0);
    return (
      <Card key={client} className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-card/40 px-4 py-2.5">
          <span className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
            <User className="size-4 text-brand-cyan-base" /> {client}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{hms(clientTotal)}</span>
        </div>
        <div className="divide-y divide-border/60">
          {projs.map((pr) => {
            const open = expanded.has(pr.id);
            return (
              <div key={pr.id}>
                <button
                  onClick={() => toggle(pr.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-card/40"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180",
                    )}
                  />
                  <FolderKanban className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground">{pr.name}</span>
                      <span className="flex shrink-0 items-center gap-2.5 text-xs">
                        {pr.rate != null && (
                          <span className="font-semibold text-primary">≈ {shekel(pr.rate)}/ש׳</span>
                        )}
                        <span className="tabular-nums text-muted-foreground">{hms(pr.total)}</span>
                      </span>
                    </div>
                    <Bar frac={pr.total / model.maxProject} />
                  </div>
                </button>
                {open && (
                  <div className="space-y-1 bg-background/30 px-4 pb-3 pe-11">
                    {pr.value > 0 && (
                      <div className="flex items-center justify-between py-1 text-xs text-muted-foreground">
                        <span>שווי הפרויקט</span>
                        <span className="tabular-nums">{shekel(pr.value)}</span>
                      </div>
                    )}
                    {pr.stages.map((st) => (
                      <div key={st.name} className="flex items-center justify-between py-1 text-[13px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {st.linked && <Link2 className="size-3 text-brand-cyan-base" />}
                          {st.name}
                        </span>
                        <span className="tabular-nums">{hms(st.sec)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* date-range filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-full border border-border/60 bg-card/60 p-1">
            {(["today", "week", "month", "all", "custom"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  range === r ? "bg-primary text-[color:var(--ink,#0a0623)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2 py-1">
              <input
                type="date"
                aria-label="מתאריך"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md bg-transparent px-2 py-1 text-xs text-foreground outline-none [color-scheme:dark]"
              />
              <span className="text-xs text-muted-foreground">עד</span>
              <input
                type="date"
                aria-label="עד תאריך"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md bg-transparent px-2 py-1 text-xs text-foreground outline-none [color-scheme:dark]"
              />
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sessions.length}>
          <Download className="size-4" /> CSV
        </Button>
      </div>

      {/* עבדתי היום — split by clients vs studio */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">עבדתי היום</p>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="על לקוחות" value={hms(glance.todayClients)} />
          <StatTile label="על הסטודיו" value={hms(glance.todayStudio)} tone="pomo" />
          <StatTile label="סה״כ" value={hms(glance.today)} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="7 ימים" value={hms(glance.week)} />
        <StatTile label={`בטווח (${rangeLabels[range]})`} value={hms(model.total)} sub={`${sessions.length} סשנים`} />
        <StatTile label="זמן משימה" value={hms(model.taskTotal)} tone="task" sub={`${taskPctVal}%`} />
        <StatTile label="זמן פומודורו" value={hms(model.pomoTotal)} tone="pomo" sub={`${pomoPctVal}%`} />
        <StatTile label="פרויקטים" value={String(model.projectRows.length)} />
      </div>

      {sessions.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">אין זמן שנמדד בטווח שנבחר.</Card>
      )}

      {/* composition: what the total is made of */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-foreground">הרכב הזמן</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" /> משימה {hms(model.taskTotal)}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-brand-cyan-base" /> פומודורו {hms(model.pomoTotal)}
            </span>
          </div>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div className="h-full bg-primary" style={{ width: `${taskPctVal}%` }} />
          <div className="h-full bg-brand-cyan-base" style={{ width: `${pomoPctVal}%` }} />
        </div>
      </Card>

      {/* time share by client (donut) */}
      {model.clientTime.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 font-heading text-sm font-semibold text-foreground">חלוקה לפי לקוח</p>
          <Donut
            data={model.clientTime}
            total={model.clientTime.reduce((a, c) => a + c.sec, 0)}
          />
        </Card>
      )}

      {/* per paying client + project */}
      {payingGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">לפי לקוח ופרויקט</h2>
          {payingGroups.map(([client, projs]) => renderClientCard(client, projs))}
        </div>
      )}

      {/* studio / internal work — kept out of the paying-client reports */}
      {internalGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Building2 className="size-5 text-primary" /> סטודיו — זמן פנימי
          </h2>
          {internalGroups.map(([client, projs]) => renderClientCard(client, projs))}
        </div>
      )}

      {/* demo / test accounts — never mixed into the real-client analytics */}
      {demoGroups.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-amber-500">
            <FlaskConical className="size-5" /> טסטים (דמה)
          </h2>
          {demoGroups.map(([client, projs]) => renderClientCard(client, projs))}
        </div>
      )}

      {/* personal labels with bars + linked-project chip */}
      {model.personalRows.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">אישי לפי תווית</h2>
          <Card className="space-y-3 p-4">
            {model.personalRows.map((r) => (
              <div key={r.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <span className="truncate">{r.label}</span>
                    {r.project && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-brand-cyan-base/30 bg-brand-cyan-base/10 px-2 py-0.5 text-[10px] text-brand-cyan-base">
                        <Link2 className="size-2.5" /> {r.project}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-brand-cyan-base">
                    {hms(r.sec)}
                  </span>
                </div>
                <Bar frac={r.sec / model.maxPersonal} tone="pomo" />
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* every session, grouped by day, filterable by mode */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">כל הסשנים</h2>
          <div className="inline-flex gap-1 rounded-full border border-border/60 bg-card/60 p-1">
            {[
              { id: "all" as const, label: "הכל" },
              { id: "up" as const, label: "משימה" },
              { id: "down" as const, label: "פומודורו" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setModeFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  modeFilter === f.id
                    ? "bg-primary text-[color:var(--ink,#0a0623)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {groupByDay(shownSessions.slice(0, 200)).map((g) => (
          <Card key={g.ms} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-2">
              <span className="text-xs font-semibold text-foreground">{dayLabel(g.ms)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{hms(g.total)}</span>
            </div>
            <div className="divide-y divide-border/60">
              {g.items.map((s) => {
                // Use the project's own TITLE (not the client-facing business
                // name) so several projects under one client — e.g. the internal
                // "Studio Ori Guy" — are distinguishable.
                const linkedProj = s.project_id ? model.projTitle.get(s.project_id) || null : null;
                const clientNm = s.client_id ? model.clientName.get(s.client_id) || null : null;
                const name =
                  s.kind === "personal"
                    ? s.label || "אישי"
                    : linkedProj || clientNm || "פרויקט";
                const stage = s.stage_id ? model.stageName.get(s.stage_id) : null;
                const down = s.mode === "down";
                // linked-personal → show project; client-only stage → "טרם פרויקט";
                // project stage → show the client (+ stage) so the row is unambiguous
                const belongsTo =
                  s.kind === "personal" && linkedProj
                    ? linkedProj
                    : s.kind === "stage" && !s.project_id && clientNm
                      ? "טרם פרויקט"
                      : s.kind === "stage" && s.project_id
                        ? [clientNm, stage].filter(Boolean).join(" · ") || null
                        : stage;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("size-1.5 shrink-0 rounded-full", down ? "bg-brand-cyan-base" : "bg-primary")} />
                      <span className="truncate text-foreground">{name}</span>
                      {belongsTo && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {s.kind === "personal" && linkedProj && <Link2 className="size-3" />}· {belongsTo}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => continueSession(s)}
                        title="המשך סשן זה"
                        className="grid size-6 place-items-center rounded-md border border-border text-muted-foreground opacity-60 hover:text-primary hover:opacity-100"
                      >
                        <Play className="size-3" />
                      </button>
                      <SessionNote sessionId={s.id} note={s.note} title={name} />
                      <button
                        onClick={() => openEdit(s)}
                        title="עריכת סשן"
                        className="grid size-6 place-items-center rounded-md border border-border text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={cn("min-w-[52px] text-end tabular-nums font-semibold", down ? "text-brand-cyan-base" : "text-primary")}>
                        {hms(s.duration_seconds)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <SessionEditorSheet open={editorOpen} onOpenChange={setEditorOpen} session={editing} />
    </div>
  );
}
