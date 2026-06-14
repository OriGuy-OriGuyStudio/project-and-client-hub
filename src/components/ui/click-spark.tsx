import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

/**
 * A global click-spark burst. Adapted from React Bits (reactbits.dev) into a
 * single fixed, viewport-sized canvas that listens for clicks anywhere - so it
 * never allocates a giant page-tall canvas. Brand-green sparks. Skips under
 * prefers-reduced-motion.
 */
export default function ClickSpark({
  sparkColor = "#B4D670",
  sparkSize = 11,
  sparkRadius = 18,
  sparkCount = 8,
  duration = 420,
}: {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ease = (t: number) => t * (2 - t); // ease-out

    let raf = 0;
    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks.current = sparks.current.filter((s) => {
        const elapsed = ts - s.startTime;
        if (elapsed >= duration) return false;
        const eased = ease(elapsed / duration);
        const dist = eased * sparkRadius;
        const len = sparkSize * (1 - eased);
        const x1 = s.x + dist * Math.cos(s.angle);
        const y1 = s.y + dist * Math.sin(s.angle);
        const x2 = s.x + (dist + len) * Math.cos(s.angle);
        const y2 = s.y + (dist + len) * Math.sin(s.angle);
        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onClick = (e: MouseEvent) => {
      const now = performance.now();
      for (let i = 0; i < sparkCount; i++) {
        sparks.current.push({
          x: e.clientX,
          y: e.clientY,
          angle: (2 * Math.PI * i) / sparkCount,
          startTime: now,
        });
      }
    };
    window.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onClick);
    };
  }, [reduced, sparkColor, sparkSize, sparkRadius, sparkCount, duration]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />;
}
