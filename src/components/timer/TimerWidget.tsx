import { useRef, useState } from "react";
import {
  Timer as TimerIcon,
  PictureInPicture2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimer } from "@/hooks/useTimer";
import { ctxTitle } from "@/lib/timer-store";
import {
  GREEN,
  CYAN,
  fmt,
  useTick,
  TimerRing,
  TimerContextPicker,
  TimerModeAndPresets,
  TimerControlsBar,
} from "@/components/timer/timer-controls";
import { openTimerPip, pipSupported } from "@/components/timer/timer-pip";

export function TimerWidget() {
  const st = useTimer();
  const accent = st.mode === "down" ? CYAN : GREEN;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      return JSON.parse(localStorage.getItem("sog-timer-pos") || "") || { x: 24, y: 24 };
    } catch {
      return { x: 24, y: 24 };
    }
  });

  // pill shows the live time even while collapsed
  const pillRef = useRef<SVGCircleElement>(null);
  const secs = useTick(pillRef);

  // ---- drag ----
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  function onDragStart(e: React.PointerEvent) {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const x = Math.max(8, drag.current.ox - (e.clientX - drag.current.sx));
    const y = Math.max(8, drag.current.oy - (e.clientY - drag.current.sy));
    setPos({ x, y });
  }
  function onDragEnd() {
    if (drag.current) localStorage.setItem("sog-timer-pos", JSON.stringify(pos));
    drag.current = null;
  }

  return (
    <div
      dir="rtl"
      className="fixed z-[70] print:hidden"
      style={{ insetInlineStart: pos.x, bottom: pos.y }}
    >
      {open ? (
        <div className="w-[320px] rounded-2xl border border-border bg-card shadow-2xl">
          {/* header (drag handle) */}
          <div
            className="flex cursor-grab touch-none items-center justify-between gap-2 rounded-t-2xl border-b border-border/60 px-3 py-2 active:cursor-grabbing"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TimerIcon className="size-4 text-primary" /> טיימר
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                אדמין בלבד
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {pipSupported() && (
                <button
                  aria-label="Picture in Picture"
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => openTimerPip()}
                >
                  <PictureInPicture2 className="size-4" />
                </button>
              )}
              <button
                aria-label="מזעור"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <TimerContextPicker />
            <TimerRing px={168} showLabels={false} />
            <TimerModeAndPresets />
            <TimerControlsBar size="md" />
          </div>
        </div>
      ) : (
        // collapsed pill
        <button
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-2xl"
          onClick={() => setOpen(true)}
        >
          <span
            className={cn("size-2 rounded-full", st.running && "animate-pulse")}
            style={{ background: accent }}
          />
          <span
            dir="ltr"
            className="font-heading text-base font-bold tabular-nums"
            style={{ color: accent }}
          >
            {fmt(secs)}
          </span>
          <span className="max-w-[120px] truncate text-xs text-muted-foreground">{ctxTitle()}</span>
        </button>
      )}
    </div>
  );
}
