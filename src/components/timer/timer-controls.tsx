import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, RotateCcw, Plus, Pencil, X, Link2 as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/utils";
import { useTimer } from "@/hooks/useTimer";
import { useProjects } from "@/hooks/useProjects";
import { useProjectStages, useTimeLabels } from "@/hooks/useTimeData";
import {
  timer,
  getDisplaySeconds,
  getElapsed,
  getFrac,
  ctxTitle,
} from "@/lib/timer-store";

const LONG_RUN_SEC = 6 * 3600; // warn if a session has been running this long

/** True once a running session passes the long-run threshold (forgot to stop). */
function useLongRun() {
  const st = useTimer();
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!st.running) {
      setOver(false);
      return;
    }
    const check = () => setOver(getElapsed() > LONG_RUN_SEC);
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [st.running]);
  return over;
}

/**
 * Shared timer UI, used by BOTH the floating {@link TimerWidget} and the
 * full-page {@link TimerBoard}. One source of truth so the pickers, ring and
 * presets stay identical everywhere and only need fixing once.
 *
 * The digits use a dead-simple CSS odometer (a stack of 0-9 translated on the
 * Y axis) — the same trick as the design mockup. The previous framer-motion
 * "sliding number" measured element heights at runtime and silently rendered
 * nothing when the measure came back 0, which is why the time went missing.
 */

export const GREEN = "#B4D670";
export const CYAN = "#77BECF";

// The floating panel sits at z-[70]; the Radix dropdown content defaults to
// z-50, so its menus opened *behind* the panel and looked "missing". Force the
// menu above everything with an important z so it always wins the cascade.
const MENU_Z = "!z-[80]";

// Ring geometry (fixed 270x270 viewBox; the SVG is just scaled in pixels).
const R = 112;
const C = 2 * Math.PI * R;

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const big = i % 5 === 0;
  const r1 = big ? 122 : 125;
  const r2 = 129;
  return {
    x1: 135 + Math.sin(a) * r1,
    y1: 135 - Math.cos(a) * r1,
    x2: 135 + Math.sin(a) * r2,
    y2: 135 - Math.cos(a) * r2,
    big,
  };
});

export function fmt(s: number) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

/** Read frac/seconds every frame for the smooth ring; bump React only per second. */
export function useTick(progressRef: React.RefObject<SVGCircleElement>) {
  const [secs, setSecs] = useState(getDisplaySeconds());
  useEffect(() => {
    let raf = 0;
    let lastSec = -1;
    const loop = () => {
      if (progressRef.current) {
        progressRef.current.style.strokeDashoffset = String(C * (1 - getFrac()));
      }
      const s = getDisplaySeconds();
      if (s !== lastSec) {
        lastSec = s;
        setSecs(s);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);
  return secs;
}

/** Static monospace-aligned time. Each glyph gets a fixed cell so the digits
 *  don't jitter as they change — but no rolling animation (Ori's call). */
function TimeDisplay({
  secs,
  h,
  w,
  fontSize,
  accent,
}: {
  secs: number;
  h: number;
  w: number;
  fontSize: number;
  accent: string;
}) {
  const text = fmt(secs);
  return (
    <div
      dir="ltr"
      className="flex items-center justify-center font-heading font-black tabular-nums"
      style={{ height: h, fontSize, color: accent, letterSpacing: 1 }}
    >
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className={cn("inline-block text-center align-top", ch === ":" && "opacity-80")}
          style={{ width: ch === ":" ? w * 0.5 : w, height: h, lineHeight: `${h}px` }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

/** The tick ring, progress ring and live digits. Optionally the mode + context
 *  labels inside the ring (the page shows them; the compact widget hides them). */
export function TimerRing({
  px = 270,
  showLabels = false,
}: {
  px?: number;
  showLabels?: boolean;
}) {
  const st = useTimer();
  const accent = st.mode === "down" ? CYAN : GREEN;
  const progressRef = useRef<SVGCircleElement>(null);
  const secs = useTick(progressRef);

  const scale = px / 270;
  const digitH = Math.round(56 * scale);
  const digitW = Math.round(33 * scale);
  const fontSize = Math.round(52 * scale);

  return (
    <div className="relative mx-auto" style={{ width: px, height: px }}>
      {/* soft glow behind the ring */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: px * 0.09,
          background: `radial-gradient(circle at 50% 45%, ${accent}42, transparent 62%)`,
          filter: `blur(${Math.round(20 * scale)}px)`,
        }}
      />
      <svg viewBox="0 0 270 270" width={px} height={px} className="relative block" aria-hidden="true">
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.big ? `${accent}66` : "rgba(246,244,244,.14)"}
            strokeWidth={t.big ? 2 : 1}
          />
        ))}
        <circle cx="135" cy="135" r={R} fill="none" stroke="rgba(246,244,244,.09)" strokeWidth="10" />
        <circle
          ref={progressRef}
          cx="135"
          cy="135"
          r={R}
          fill="none"
          stroke={accent}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C}
          transform="rotate(-90 135 135)"
          style={{ transition: "stroke .3s" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center">
        <TimeDisplay secs={secs} h={digitH} w={digitW} fontSize={fontSize} accent={accent} />
        {showLabels && (
          <>
            <p className="text-[13px] text-muted-foreground">
              {st.mode === "down" ? "ספירה לאחור" : "ספירה למעלה"}
            </p>
            <p
              className="max-w-[200px] truncate text-[13px] font-semibold"
              style={{ color: accent }}
            >
              {ctxTitle()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- context picker (project/stage OR personal label) --------- */
export function TimerContextPicker() {
  const st = useTimer();
  const kind = st.ctx.kind;
  return (
    <div className="space-y-2.5">
      <div className="mx-auto flex w-max gap-1 rounded-full border border-border/60 bg-background/40 p-1">
        <button
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
            kind === "stage" ? "text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
          )}
          style={kind === "stage" ? { background: st.mode === "down" ? CYAN : GREEN } : undefined}
          onClick={() => timer.setCtx({ kind: "stage" })}
        >
          פרויקט
        </button>
        <button
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
            kind === "personal" ? "text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
          )}
          style={kind === "personal" ? { background: st.mode === "down" ? CYAN : GREEN } : undefined}
          onClick={() => timer.setCtx({ kind: "personal" })}
        >
          אישי
        </button>
      </div>
      {kind === "stage" ? <ProjectPicker /> : <PersonalPicker />}
    </div>
  );
}

function ProjectPicker() {
  const st = useTimer();
  const { data: projects = [] } = useProjects();
  const [clientId, setClientId] = useState<string>("");

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.client_id, p.business_name || p.title));
    return [...m.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [projects]);

  const shown = clientId ? projects.filter((p) => p.client_id === clientId) : projects;
  const { data: stages = [] } = useProjectStages(st.ctx.projectId);

  return (
    <div className="grid grid-cols-1 gap-2">
      <SelectMenu
        variant="field"
        contentClassName={MENU_Z}
        placeholder="כל הלקוחות"
        value={clientId}
        onChange={(v) => setClientId(v)}
        options={[{ value: "", label: "כל הלקוחות" }, ...clients]}
        ariaLabel="לקוח"
      />
      <SelectMenu
        variant="field"
        contentClassName={MENU_Z}
        placeholder="בחר פרויקט…"
        value={st.ctx.projectId ?? ""}
        onChange={(v) => {
          const p = projects.find((x) => x.id === v);
          timer.setCtx({
            kind: "stage",
            projectId: v,
            projectName: p?.business_name || p?.title,
            clientId: p?.client_id,
            stageId: null,
            stageName: null,
          });
        }}
        options={shown.map((p) => ({
          value: p.id,
          label: p.business_name ? `${p.business_name} · ${p.title}` : p.title,
        }))}
        ariaLabel="פרויקט"
      />
      <SelectMenu
        variant="field"
        contentClassName={MENU_Z}
        placeholder={stages.length ? "בחר שלב…" : "אין שלבים בפרויקט"}
        value={st.ctx.stageId ?? ""}
        onChange={(v) => {
          const s = stages.find((x) => x.id === v);
          timer.setCtx({ stageId: v, stageName: s?.title });
        }}
        options={stages.map((s) => ({ value: s.id, label: s.title }))}
        ariaLabel="שלב"
      />
    </div>
  );
}

function PersonalPicker() {
  const st = useTimer();
  const { labels, add, rename, remove, link } = useTimeLabels();
  const { data: projects = [] } = useProjects();
  const [editing, setEditing] = useState<null | { id: string | null }>(null);
  const [draft, setDraft] = useState("");

  const current = labels.find((l) => l.name === st.ctx.label);

  const projName = (id: string | null | undefined) => {
    if (!id) return null;
    const p = projects.find((x) => x.id === id);
    return p ? p.business_name || p.title : null;
  };

  // Point the running context at the label's linked project (or clear it).
  function selectLabel(name: string) {
    const l = labels.find((x) => x.name === name);
    timer.setCtx({
      kind: "personal",
      label: name,
      projectId: l?.project_id ?? null,
      projectName: projName(l?.project_id) ?? null,
      stageId: null,
      stageName: null,
    });
  }

  function startAdd() {
    setEditing({ id: null });
    setDraft("");
  }
  function startEdit() {
    if (!current) return;
    setEditing({ id: current.id });
    setDraft(current.name);
  }
  async function commit() {
    const v = draft.trim();
    setEditing(null);
    if (!v) return;
    if (editing?.id) {
      await rename(editing.id, v);
    } else {
      await add(v);
    }
    selectLabel(v);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {editing ? (
          <Input
            autoFocus
            className="h-10 w-44"
            placeholder="שם תווית…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(null);
            }}
            onBlur={commit}
          />
        ) : (
          <SelectMenu
            variant="field"
            contentClassName={MENU_Z}
            className="min-w-[180px]"
            placeholder="בחר תווית…"
            value={st.ctx.label ?? ""}
            onChange={selectLabel}
            options={labels.map((l) => ({ value: l.name, label: l.name }))}
            ariaLabel="תווית אישית"
          />
        )}
        <button
          aria-label="חדשה"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          onClick={startAdd}
        >
          <Plus className="size-4" />
        </button>
        <button
          aria-label="ערוך"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          onClick={startEdit}
        >
          <Pencil className="size-4" />
        </button>
        <button
          aria-label="מחק"
          className="grid size-9 place-items-center rounded-lg border border-border text-destructive"
          onClick={async () => {
            if (current && labels.length > 1) {
              await remove(current.id);
              const next = labels.find((l) => l.id !== current.id);
              if (next) selectLabel(next.name);
            }
          }}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* optional: tie this label to a project so its time counts there too */}
      {current && (
        <div className="flex items-center justify-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <LinkIcon className="size-3" /> משויך לפרויקט:
          </span>
          <SelectMenu
            variant="field"
            contentClassName={MENU_Z}
            className="h-9 min-w-[190px] text-xs"
            placeholder="ללא (אישי בלבד)"
            value={current.project_id ?? ""}
            onChange={async (v) => {
              await link(current.id, v || null);
              const p = projects.find((x) => x.id === v);
              timer.setCtx({
                kind: "personal",
                label: current.name,
                projectId: v || null,
                projectName: p ? p.business_name || p.title : null,
                stageId: null,
                stageName: null,
              });
            }}
            options={[
              { value: "", label: "ללא (אישי בלבד)" },
              ...projects.map((p) => ({
                value: p.id,
                label: p.business_name ? `${p.business_name} · ${p.title}` : p.title,
              })),
            ]}
            ariaLabel="שיוך תווית לפרויקט"
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- mode + presets ---------------- */
export function TimerModeAndPresets() {
  const st = useTimer();
  const [custom, setCustom] = useState(30);
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="space-y-3">
      <div className="mx-auto flex w-max gap-1 rounded-full border border-border/60 bg-background/40 p-1">
        <button
          className={cn(
            "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
            st.mode === "up" ? "bg-primary text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
          )}
          onClick={() => timer.setMode("up")}
        >
          משימה
        </button>
        <button
          className={cn(
            "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
            st.mode === "down" ? "text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
          )}
          style={st.mode === "down" ? { background: CYAN } : undefined}
          onClick={() => timer.setMode("down")}
        >
          פומודורו
        </button>
      </div>
      {st.mode === "down" && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[15, 25, 50].map((m) => {
            const on = !showCustom && st.plannedSeconds === m * 60;
            return (
              <button
                key={m}
                className={cn(
                  "rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  on ? "bg-[color:rgba(119,190,207,.08)]" : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={on ? { borderColor: CYAN, color: CYAN } : undefined}
                onClick={() => {
                  setShowCustom(false);
                  timer.setPlanned(m * 60);
                }}
              >
                {m} דק׳
              </button>
            );
          })}
          <button
            className={cn(
              "rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              showCustom ? "bg-[color:rgba(119,190,207,.08)]" : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={showCustom ? { borderColor: CYAN, color: CYAN } : undefined}
            onClick={() => {
              setShowCustom(true);
              timer.setPlanned(custom * 60);
            }}
          >
            מותאם
          </button>
          {showCustom && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1">
              <button
                className="grid size-7 place-items-center rounded-md bg-white/5 text-foreground hover:text-[color:var(--cyan)]"
                onClick={() => {
                  const v = Math.max(1, custom - 1);
                  setCustom(v);
                  timer.setPlanned(v * 60);
                }}
              >
                −
              </button>
              <input
                type="number"
                className="w-11 bg-transparent text-center text-sm font-bold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                value={custom}
                min={1}
                max={180}
                onChange={(e) => {
                  const v = Math.min(180, Math.max(1, parseInt(e.target.value || "1", 10)));
                  setCustom(v);
                  timer.setPlanned(v * 60);
                }}
              />
              <button
                className="grid size-7 place-items-center rounded-md bg-white/5 text-foreground hover:text-[color:var(--cyan)]"
                onClick={() => {
                  const v = Math.min(180, custom + 1);
                  setCustom(v);
                  timer.setPlanned(v * 60);
                }}
              >
                +
              </button>
              <span className="pe-1.5 text-xs text-muted-foreground">דק׳</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- transport controls (play / pause / stop / reset) --------- */
export function TimerControlsBar({ size = "lg" }: { size?: "md" | "lg" }) {
  const st = useTimer();
  const accent = st.mode === "down" ? CYAN : GREEN;
  const big = size === "lg";
  const longRun = useLongRun();
  return (
    <div className="space-y-3">
      {longRun && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          <span>הטיימר רץ כבר יותר מ-6 שעות. שכחת לעצור?</span>
          <button
            className="shrink-0 rounded-md border border-amber-500/50 px-2 py-1 font-semibold hover:bg-amber-500/20"
            onClick={() => timer.stop()}
          >
            עצור ושמור
          </button>
        </div>
      )}
      <div className="flex items-center justify-center gap-3.5">
        <button
          aria-label="איפוס בלי שמירה"
          title="איפוס (מחיקה, בלי שמירה)"
          className={cn(
            "grid place-items-center rounded-full border border-border bg-white/5 text-foreground transition hover:border-primary/50",
            big ? "size-[52px]" : "size-11",
          )}
          onClick={() => timer.reset()}
        >
          <RotateCcw className={big ? "size-5" : "size-4"} />
        </button>
        <button
          aria-label="הפעלה/השהיה"
          className={cn(
            "grid place-items-center rounded-full text-[color:var(--ink,#0a0623)] transition",
            big ? "size-[74px]" : "size-14",
          )}
          style={{ background: accent, boxShadow: `0 8px 30px ${accent}42` }}
          onClick={() => timer.toggle()}
        >
          {st.running ? (
            <Pause className={big ? "size-7" : "size-6"} />
          ) : (
            <Play className={big ? "size-7" : "size-6"} />
          )}
        </button>
        <button
          aria-label="סיום סשן ושמירה"
          title="סיום סשן ושמירה"
          className={cn(
            "grid place-items-center rounded-full border border-border bg-white/5 text-foreground transition hover:border-primary/50",
            big ? "size-[52px]" : "size-11",
          )}
          onClick={() => timer.stop()}
        >
          <Square className={big ? "size-5" : "size-4"} />
        </button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        ▶ הפעלה/השהיה · ⏹ סיום ושמירה · ↻ איפוס בלי שמירה
      </p>
      {st.done && (
        <button
          className="mx-auto block rounded-xl border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: `${CYAN}73`, color: CYAN, background: `${CYAN}1f` }}
          onClick={() => timer.extend(5 * 60)}
        >
          הסתיים ונשמר · הארכה ב-5 דק׳ ↻
        </button>
      )}
    </div>
  );
}
