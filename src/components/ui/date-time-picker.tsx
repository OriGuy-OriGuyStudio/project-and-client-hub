import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/** A themed RTL date + time picker (replaces the native datetime-local). */
export function DateTimePicker({
  value,
  onChange,
  id,
  placeholder = "בחר תאריך",
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value) : null;
  const [view, setView] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(view), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(view), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [view]);

  const timeStr = selected ? format(selected, "HH:mm") : "12:00";

  function pickDay(day: Date) {
    const [h, m] = timeStr.split(":").map(Number);
    const next = new Date(day);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(next.toISOString());
  }
  function setTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    const base = selected ?? new Date();
    const next = new Date(base);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(next.toISOString());
  }

  return (
    <div className="relative" ref={ref}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-field px-3 text-sm text-foreground transition-colors hover:border-input/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? format(selected, "dd/MM/yyyy · HH:mm") : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {selected && (
            <X
              className="size-4 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          )}
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute z-50 mt-2 w-72 rounded-2xl border border-border bg-card p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="חודש קודם"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setView((v) => addMonths(v, -1))}
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="font-heading text-sm font-bold text-foreground">
              {format(view, "MMMM yyyy", { locale: he })}
            </span>
            <button
              type="button"
              aria-label="חודש הבא"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setView((v) => addMonths(v, 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-[11px] font-medium text-muted-foreground">
                {d}
              </span>
            ))}
            {days.map((day) => {
              const isSel = selected && isSameDay(day, selected);
              const dim = !isSameMonth(day, view);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={cn(
                    "relative h-8 rounded-lg text-sm transition-colors",
                    isSel
                      ? "bg-primary font-bold text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                    dim && !isSel && "text-muted-foreground/40",
                    isToday(day) && !isSel && "ring-1 ring-primary/50"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTime(e.target.value)}
              className="h-9 rounded-lg border border-input bg-field px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(null)}
              >
                נקה
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                onClick={() => {
                  const now = new Date();
                  setView(now);
                  pickDay(now);
                  setOpen(false);
                }}
              >
                היום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
