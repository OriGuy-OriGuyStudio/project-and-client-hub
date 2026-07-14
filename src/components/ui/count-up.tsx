import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Count-up number animation. Adapted from React Bits (reactbits.dev). The number
 * is ALWAYS rendered at its correct value (critical: this is a price), and the
 * count-up is a pure enhancement: on first scroll into view it springs from
 * `from` up to `to`, and re-animates from its current value whenever `to` changes
 * (e.g. an upsell is toggled). Static under prefers-reduced-motion, and if the
 * IntersectionObserver never fires the value simply stays correct. Uses a plain
 * rAF tween so it has no animation-library dependency.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1100,
  format,
  className,
  style,
}: {
  to: number;
  from?: number;
  duration?: number;
  format: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const started = useRef(false);
  const shown = useRef(to);
  const raf = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setText = (v: number) => {
      shown.current = v;
      if (ref.current) ref.current.textContent = format(v);
    };

    if (reduced) {
      setText(to);
      return;
    }

    const tween = (startVal: number) => {
      cancelAnimationFrame(raf.current);
      const t0 = performance.now();
      const delta = to - startVal;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        setText(startVal + delta * easeOutExpo(p));
        if (p < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };

    // Already counted once: `to` changed (e.g. upsell toggled) -> animate from current.
    if (started.current) {
      tween(shown.current);
      return () => cancelAnimationFrame(raf.current);
    }

    // First time: show the correct value now (safe), animate up when scrolled in.
    setText(to);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          started.current = true;
          tween(from);
          io.disconnect();
        }
      },
      { rootMargin: "-40px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduced]);

  return (
    <span ref={ref} className={className} style={style}>
      {format(to)}
    </span>
  );
}
