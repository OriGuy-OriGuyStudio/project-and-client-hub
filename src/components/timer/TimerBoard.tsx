import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PictureInPicture2, Play, Pencil, Plus } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { timer, ctxTitle, ctxFromSession } from "@/lib/timer-store";
import { supabase } from "@/lib/supabase";
import { useProjects } from "@/hooks/useProjects";
import { useProjectBilling, useTimeSessions } from "@/hooks/useTimeData";
import {
  CYAN,
  GREEN,
  TimerRing,
  TimerContextPicker,
  TimerModeAndPresets,
  TimerControlsBar,
} from "@/components/timer/timer-controls";
import { openTimerPip, pipSupported } from "@/components/timer/timer-pip";
import { SessionNote } from "@/components/timer/SessionNote";
import { SessionEditorSheet } from "@/components/timer/SessionEditorSheet";
import type { TimeSession } from "@/types/database";

const DAY = 86400000;
const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
function hms(s: number) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${h}:${p(m)}:${p(ss)}`;
}
function whenLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The full-page timer workspace. On wide screens it's a two-column layout: the
 * timer card on one side, and a daily/weekly summary + the context's sessions
 * on the other, so the width isn't wasted. Shares the singleton store with the
 * floating widget, so a session started here keeps running everywhere.
 */
export function TimerBoard() {
  const st = useTimer();
  const accent = st.mode === "down" ? CYAN : GREEN;
  const { data: billing } = useProjectBilling(st.ctx.projectId ?? undefined);
  const value = Number(billing?.value ?? 0);

  const { data: sessions = [] } = useTimeSessions();

  const ctxSessions = useMemo(() => {
    const c = st.ctx;
    return sessions
      .filter((s: TimeSession) =>
        c.kind === "personal"
          ? s.kind === "personal" && s.label === c.label
          : s.kind === "stage" && s.project_id === c.projectId && (!c.stageId || s.stage_id === c.stageId),
      )
      .slice(0, 8);
  }, [sessions, st.ctx]);
  const ctxTotal = ctxSessions.reduce((a, s) => a + s.duration_seconds, 0);

  // Whole-project total (all stages + linked personal) for the ₪/hour estimate.
  const projectTotalSec = useMemo(() => {
    const pid = st.ctx.projectId;
    if (!pid) return 0;
    return sessions.filter((s) => s.project_id === pid).reduce((a, s) => a + s.duration_seconds, 0);
  }, [sessions, st.ctx.projectId]);
  const rate = value > 0 && projectTotalSec > 0 ? value / (projectTotalSec / 3600) : null;

  // names for quick-start / continue labels
  const { data: projects = [] } = useProjects();
  const { data: allStages = [] } = useQuery({
    queryKey: ["all-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("project_stages").select("id, title, project_id");
      return data ?? [];
    },
  });
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.business_name || p.title])), [projects]);
  const stageName = useMemo(() => new Map(allStages.map((s) => [s.id, s.title])), [allStages]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TimeSession | null>(null);
  const openManual = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (s: TimeSession) => {
    setEditing(s);
    setEditorOpen(true);
  };
  const continueSession = (s: TimeSession) =>
    timer.start(
      ctxFromSession(s, {
        project: (id) => projName.get(id) ?? null,
        stage: (id) => stageName.get(id) ?? null,
      }),
      { mode: s.mode },
    );

  // recent, distinct contexts for one-click quick-start
  const recentContexts = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; title: string; s: TimeSession }[] = [];
    for (const s of sessions) {
      const key = s.kind === "personal" ? `p:${s.label}` : `s:${s.project_id}:${s.stage_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const title =
        s.kind === "personal"
          ? s.label || "אישי"
          : [s.project_id ? projName.get(s.project_id) : null, s.stage_id ? stageName.get(s.stage_id) : null]
              .filter(Boolean)
              .join(" · ") || "פרויקט";
      out.push({ key, title, s });
      if (out.length >= 5) break;
    }
    return out;
  }, [sessions, projName, stageName]);

  // daily/weekly rollup for the summary panel + the 7-day mini chart
  const summary = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayStart = start.getTime();
    const days = Array.from({ length: 7 }, (_, i) => {
      const s = todayStart - (6 - i) * DAY;
      return { ts: s, sec: 0, label: new Date(s).toLocaleDateString("he-IL", { weekday: "narrow" }) };
    });
    let today = 0;
    let week = 0;
    let todayCount = 0;
    const weekAgo = Date.now() - 7 * DAY;
    for (const s of sessions) {
      const t = new Date(s.started_at).getTime();
      if (t >= weekAgo) week += s.duration_seconds;
      if (t >= todayStart) {
        today += s.duration_seconds;
        todayCount++;
      }
      const idx = Math.floor((t - days[0].ts) / DAY);
      if (idx >= 0 && idx < 7) days[idx].sec += s.duration_seconds;
    }
    const max = days.reduce((m, d) => Math.max(m, d.sec), 0) || 1;
    return { days, max, today, week, todayCount };
  }, [sessions]);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:items-start">
      {/* ---- timer card ---- */}
      <div className="rounded-[22px] border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="truncate text-xs text-muted-foreground">
            מודד עכשיו · <span className="font-semibold text-foreground">{ctxTitle()}</span>
          </p>
          {pipSupported() && (
            <button
              aria-label="חלון צף (Picture in Picture)"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
              onClick={() => openTimerPip()}
            >
              <PictureInPicture2 className="size-4" />
            </button>
          )}
        </div>

        <div className="space-y-5">
          <TimerContextPicker />
          <TimerRing px={270} showLabels />
          <TimerModeAndPresets />
          <TimerControlsBar size="lg" />

          {st.ctx.projectId && value > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              שווי הפרויקט: <span className="font-semibold text-foreground">{shekel(value)}</span>
              {rate != null && (
                <> · <span className="font-semibold text-primary">≈ {shekel(rate)}/שעה</span></>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ---- side workspace: daily summary + context sessions ---- */}
      <div className="space-y-4">
        {/* one-click resume of recent contexts */}
        {recentContexts.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-[11px] text-muted-foreground">התחלה מהירה</p>
            <div className="flex flex-wrap gap-2">
              {recentContexts.map((r) => (
                <button
                  key={r.key}
                  onClick={() => continueSession(r.s)}
                  title={`התחל: ${r.title}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50"
                >
                  <Play className="size-3 text-primary" />
                  <span className="max-w-[160px] truncate">{r.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* today / week + 7-day chart */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-background/40 p-3">
              <p className="text-[11px] text-muted-foreground">עבדתי היום</p>
              <p className="font-heading text-2xl font-bold tabular-nums" style={{ color: accent }}>
                {hms(summary.today)}
              </p>
              <p className="text-[11px] text-muted-foreground">{summary.todayCount} סשנים</p>
            </div>
            <div className="rounded-xl bg-background/40 p-3">
              <p className="text-[11px] text-muted-foreground">השבוע</p>
              <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {hms(summary.week)}
              </p>
            </div>
          </div>

          <p className="mb-2 mt-4 text-[11px] text-muted-foreground">7 ימים אחרונים</p>
          <div className="flex items-end justify-between gap-1.5" style={{ height: 68 }}>
            {summary.days.map((d, i) => {
              const isToday = i === summary.days.length - 1;
              const h = d.sec > 0 ? Math.max(6, Math.round((d.sec / summary.max) * 52)) : 3;
              return (
                <div key={d.ts} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-md"
                    style={{
                      height: h,
                      background: isToday ? accent : "rgba(246,244,244,.16)",
                    }}
                    title={`${d.label}: ${hms(d.sec)}`}
                  />
                  <span className={isToday ? "text-[10px] font-semibold" : "text-[10px] text-muted-foreground"}
                    style={isToday ? { color: accent } : undefined}
                  >
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* sessions already logged for the selected context */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <p className="truncate font-heading text-sm font-semibold text-foreground">
              סשנים · {ctxTitle()}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {ctxSessions.length} · סה״כ{" "}
                <span className="font-semibold tabular-nums" style={{ color: accent }}>
                  {hms(ctxTotal)}
                </span>
              </p>
              <button
                onClick={openManual}
                title="הוספת זמן ידנית"
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" /> ידני
              </button>
            </div>
          </div>
          {ctxSessions.length === 0 ? (
            <p className="px-4 pb-4 pt-1 text-center text-[13px] text-muted-foreground">
              אין עדיין סשנים בהקשר הזה. התחל טיימר.
            </p>
          ) : (
            <div>
              {ctxSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-[13px]"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: s.mode === "down" ? CYAN : GREEN }}
                    />
                    {whenLabel(s.started_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => continueSession(s)}
                      title="המשך סשן זה"
                      className="grid size-6 place-items-center rounded-md border border-border text-muted-foreground opacity-60 hover:text-primary hover:opacity-100"
                    >
                      <Play className="size-3" />
                    </button>
                    <SessionNote sessionId={s.id} note={s.note} title={ctxTitle()} />
                    <button
                      onClick={() => openEdit(s)}
                      title="עריכת סשן"
                      className="grid size-6 place-items-center rounded-md border border-border text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <span
                      className="min-w-[52px] text-end font-semibold tabular-nums"
                      style={{ color: s.mode === "down" ? CYAN : GREEN }}
                    >
                      {hms(s.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SessionEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        session={editing}
        presetCtx={{
          kind: st.ctx.kind,
          projectId: st.ctx.projectId,
          stageId: st.ctx.stageId,
          label: st.ctx.label,
        }}
      />
    </div>
  );
}
