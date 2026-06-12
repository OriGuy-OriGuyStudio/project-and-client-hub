import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Smoothly counts the displayed number up/down to `value` (game-style). */
export function AnimatedNumber({
  value,
  className,
  duration = 700,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const reduced = usePrefersReducedMotion();
  // Start from 0 so there's always a satisfying count-up on first render.
  const [display, setDisplay] = useState(0);
  // Mirror the live displayed value so each run animates from where we are.
  // (A ref that we mutate in cleanup is not StrictMode-safe - the double
  // mount would advance it to the target and skip the animation, leaving 0.)
  const displayRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduced]);

  return <span className={className}>{display.toLocaleString("he-IL")}</span>;
}
