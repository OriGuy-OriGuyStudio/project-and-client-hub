import { supabase } from "@/lib/supabase";
import { celebrate } from "@/lib/confetti";

/**
 * Singleton time-tracker store (admin-only). Framework-agnostic so the floating
 * widget, the tab title, and a Picture-in-Picture window can all read one source
 * of truth. Only configuration changes trigger React re-renders (via
 * subscribe); the smooth per-frame ring/second updates are read on demand with
 * getElapsed()/getFrac() so we never re-render at 60fps.
 */

export type TimerCtx = {
  kind: "stage" | "personal";
  clientId?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  /** This session counts toward the project's retainer hours (not general work). */
  retainer?: boolean;
  /** Optional: time tracked against a specific service call (קריאת שירות). */
  serviceCallId?: string | null;
  serviceCallTitle?: string | null;
  label?: string | null;
};

export type TimerMode = "up" | "down";

type State = {
  running: boolean;
  mode: TimerMode;
  plannedSeconds: number; // target for countdown
  accumulated: number; // seconds banked before the current running segment
  runStartedAt: number | null; // epoch ms the current segment began
  sessionStartedAt: string | null; // ISO when the session first started
  ctx: TimerCtx;
  done: boolean;
};

const KEY = "sog-timer";
const DEFAULT_CTX: TimerCtx = { kind: "stage", projectId: null, stageId: null, label: null };

const finiteNum = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<State>;
      const b = blank();
      // Sanitise the numeric fields: a stale NaN (e.g. from an emptied custom
      // input in an earlier build) would otherwise blank out the whole display.
      return {
        ...b,
        ...p,
        plannedSeconds: Math.max(1, finiteNum(p.plannedSeconds, b.plannedSeconds)),
        accumulated: Math.max(0, finiteNum(p.accumulated, 0)),
        runStartedAt: finiteNum(p.runStartedAt, 0) > 0 ? p.runStartedAt! : null,
      };
    }
  } catch {
    /* ignore */
  }
  return blank();
}
function blank(): State {
  return {
    running: false,
    mode: "down",
    plannedSeconds: 25 * 60,
    accumulated: 0,
    runStartedAt: null,
    sessionStartedAt: null,
    ctx: DEFAULT_CTX,
    done: false,
  };
}

let state: State = typeof window === "undefined" ? blank() : load();
const listeners = new Set<() => void>();
let loopId: number | null = null;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
function emit() {
  state = { ...state };
  persist();
  listeners.forEach((l) => l());
}

/* ---------- derived (read on demand, not stored) ---------- */
export function getElapsed(): number {
  const seg = state.running && state.runStartedAt ? (Date.now() - state.runStartedAt) / 1000 : 0;
  return state.accumulated + seg;
}
export function getRemaining(): number {
  return Math.max(0, state.plannedSeconds - getElapsed());
}
export function getDisplaySeconds(): number {
  return state.mode === "down" ? Math.round(getRemaining()) : Math.floor(getElapsed());
}
export function getFrac(): number {
  const el = getElapsed();
  return state.mode === "down"
    ? state.plannedSeconds
      ? Math.min(1, el / state.plannedSeconds)
      : 0
    : (el % 3600) / 3600;
}
export function getState(): Readonly<State> {
  return state;
}
export function ctxTitle(): string {
  const c = state.ctx;
  if (c.kind === "personal") return c.label || "אישי";
  if (c.serviceCallTitle) {
    return c.projectName ? `${c.serviceCallTitle} · ${c.projectName}` : c.serviceCallTitle;
  }
  const parts = [c.projectName, c.stageName].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return c.clientName || "פרויקט";
}

/** Rebuild a timer context from a stored session (for "continue" / quick-start). */
export function ctxFromSession(
  s: {
    kind: "stage" | "personal";
    client_id?: string | null;
    project_id: string | null;
    stage_id: string | null;
    service_call_id?: string | null;
    label: string | null;
  },
  names?: {
    project?: (id: string) => string | null;
    stage?: (id: string) => string | null;
    client?: (id: string) => string | null;
    serviceCall?: (id: string) => string | null;
  },
): Partial<TimerCtx> {
  const projectName = s.project_id ? names?.project?.(s.project_id) ?? null : null;
  const clientName = s.client_id ? names?.client?.(s.client_id) ?? null : null;
  if (s.kind === "personal") {
    return { kind: "personal", label: s.label, projectId: s.project_id, projectName, stageId: null, stageName: null };
  }
  return {
    kind: "stage",
    clientId: s.client_id ?? null,
    clientName,
    projectId: s.project_id,
    projectName,
    stageId: s.stage_id,
    stageName: s.stage_id ? names?.stage?.(s.stage_id) ?? null : null,
    serviceCallId: s.service_call_id ?? null,
    serviceCallTitle: s.service_call_id ? names?.serviceCall?.(s.service_call_id) ?? null : null,
    label: null,
  };
}

/* ---------- audio chime ---------- */
let actx: AudioContext | null = null;
function unlockAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (actx.state === "suspended") void actx.resume();
  } catch {
    /* ignore */
  }
}
function chime() {
  if (!actx) return;
  const n = actx.currentTime;
  [784, 1046, 1568].forEach((f, i) => {
    const o = actx!.createOscillator();
    const g = actx!.createGain();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    g.connect(actx!.destination);
    const t = n + i * 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.start(t);
    o.stop(t + 0.6);
  });
}

/* ---------- tab title ---------- */
let titleOwned = false;
export function isTimerTitleActive() {
  return titleOwned;
}
function fmt(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}
function applyTitle() {
  if (state.running) {
    titleOwned = true;
    document.title = `${fmt(getDisplaySeconds())} · ${ctxTitle()}`;
  } else if (titleOwned) {
    titleOwned = false; // AppShell's own effect will restore the page title
    document.dispatchEvent(new Event("timer-title-release"));
  }
}

/* ---------- loop: done-detection + title, runs while active ---------- */
function startLoop() {
  if (loopId != null) return;
  loopId = window.setInterval(() => {
    if (!state.running) return;
    applyTitle();
    if (state.mode === "down" && getRemaining() <= 0) void finish(true);
  }, 250);
}
function stopLoop() {
  if (loopId != null) {
    window.clearInterval(loopId);
    loopId = null;
  }
}

/* ---------- persistence of a completed session ---------- */
async function saveSession(durationSec: number) {
  if (durationSec < 1) return;
  const c = state.ctx;
  const { error } = await supabase.from("time_sessions").insert({
    kind: c.kind,
    // client_id lets us attribute time to a client even before a project exists
    // (pre-project sales/discovery). project_id is set for stage sessions and
    // for personal labels linked to a project.
    client_id: c.clientId ?? null,
    project_id: c.projectId ?? null,
    stage_id: c.kind === "stage" ? c.stageId ?? null : null,
    is_retainer: c.kind === "stage" ? !!c.retainer : false,
    service_call_id: c.kind === "stage" ? c.serviceCallId ?? null : null,
    label: c.kind === "personal" ? c.label ?? null : null,
    mode: state.mode,
    planned_seconds: state.mode === "down" ? state.plannedSeconds : null,
    started_at: state.sessionStartedAt ?? new Date().toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: Math.round(durationSec),
  });
  if (!error) window.dispatchEvent(new Event("timer-session-saved"));
}

/* ---------- actions ---------- */
function beginSegment() {
  state.running = true;
  state.runStartedAt = Date.now();
  if (!state.sessionStartedAt) state.sessionStartedAt = new Date().toISOString();
  state.done = false;
  startLoop();
}

export const timer = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return state;
  },
  start(ctx?: Partial<TimerCtx>, opts?: { mode?: TimerMode; planned?: number }) {
    unlockAudio();
    if (ctx) state.ctx = { ...state.ctx, ...ctx };
    if (opts?.mode) state.mode = opts.mode;
    if (opts?.planned != null) state.plannedSeconds = opts.planned;
    state.accumulated = 0;
    state.sessionStartedAt = null;
    beginSegment();
    emit();
  },
  toggle() {
    unlockAudio();
    if (state.running) {
      // pause: bank elapsed, keep the session open
      state.accumulated = getElapsed();
      state.running = false;
      state.runStartedAt = null;
    } else {
      if (state.done) return;
      beginSegment();
    }
    applyTitle();
    emit();
  },
  async stop() {
    // finish early + save
    const dur = getElapsed();
    state.running = false;
    state.runStartedAt = null;
    await saveSession(dur);
    resetInternal();
    applyTitle();
    emit();
  },
  reset() {
    // discard, no save
    resetInternal();
    applyTitle();
    emit();
  },
  setMode(m: TimerMode) {
    state.mode = m;
    resetInternal();
    emit();
  },
  setPlanned(sec: number) {
    state.plannedSeconds = Math.max(1, Math.round(sec));
    if (state.mode === "down") resetInternal();
    emit();
  },
  setCtx(ctx: Partial<TimerCtx>) {
    state.ctx = { ...state.ctx, ...ctx };
    resetInternal();
    emit();
  },
  extend(sec: number) {
    unlockAudio();
    state.plannedSeconds += sec;
    beginSegment();
    emit();
  },
};

function resetInternal() {
  state.accumulated = 0;
  state.running = false;
  state.runStartedAt = null;
  state.sessionStartedAt = null;
  state.done = false;
  stopLoop();
}

async function finish(celebrateNow: boolean) {
  state.running = false;
  state.runStartedAt = null;
  state.accumulated = state.plannedSeconds;
  const dur = getElapsed();
  await saveSession(dur);
  state.done = true;
  stopLoop();
  if (celebrateNow) {
    celebrate();
    chime();
  }
  applyTitle();
  emit();
}

// Resume the loop if a running session was restored from storage.
if (typeof window !== "undefined" && state.running) startLoop();
