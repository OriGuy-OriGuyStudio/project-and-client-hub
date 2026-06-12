import { useEffect, useRef } from "react";
import gsap from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

gsap.registerPlugin(InertiaPlugin);

type Dot = HTMLDivElement & {
  _isHole?: boolean;
  _inertiaApplied?: boolean;
  _lit?: boolean;
};

/**
 * Interactive dots-grid background (Osmo Supply "Glowing Interactive Dots
 * Grid"), brand-themed. Dots glow brand-green near the pointer and scatter with
 * inertia on fast moves / clicks. Used on the pre-login screens.
 */
export function DotsGrid({
  className,
  centerHole = true,
}: {
  className?: string;
  centerHole?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = { base: "rgba(130,200,165,0.07)", active: "#B4D670" };
    const threshold = 200;
    const speedThreshold = 100;
    const shockRadius = 325;
    const shockPower = 5;
    const maxSpeed = 5000;

    let dots: Dot[] = [];
    let dotCenters: { el: Dot; x: number; y: number }[] = [];

    function buildGrid() {
      container!.innerHTML = "";
      dots = [];
      dotCenters = [];

      const style = getComputedStyle(container!);
      const dotPx = parseFloat(style.fontSize);
      const gapPx = dotPx * 4; // matches the CSS `gap: 4em`
      const contW = container!.clientWidth;
      const contH = container!.clientHeight;

      const cols = Math.max(1, Math.floor((contW + gapPx) / (dotPx + gapPx)));
      const rows = Math.max(1, Math.floor((contH + gapPx) / (dotPx + gapPx)));
      const total = cols * rows;

      const holeCols = centerHole ? (cols % 2 === 0 ? 4 : 5) : 0;
      const holeRows = centerHole ? (rows % 2 === 0 ? 4 : 5) : 0;
      const startCol = (cols - holeCols) / 2;
      const startRow = (rows - holeRows) / 2;

      for (let i = 0; i < total; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const isHole =
          centerHole &&
          row >= startRow &&
          row < startRow + holeRows &&
          col >= startCol &&
          col < startCol + holeCols;

        const d = document.createElement("div") as Dot;
        d.classList.add("dot");

        if (isHole) {
          d.style.visibility = "hidden";
          d._isHole = true;
        } else {
          gsap.set(d, { x: 0, y: 0, backgroundColor: colors.base });
          d._inertiaApplied = false;
        }

        container!.appendChild(d);
        dots.push(d);
      }

      requestAnimationFrame(() => {
        dotCenters = dots
          .filter((d) => !d._isHole)
          .map((d) => {
            const r = d.getBoundingClientRect();
            return {
              el: d,
              x: r.left + window.scrollX + r.width / 2,
              y: r.top + window.scrollY + r.height / 2,
            };
          });
      });
    }

    let lastTime = 0,
      lastX = 0,
      lastY = 0;

    function onMove(e: MouseEvent) {
      const now = performance.now();
      const dt = now - lastTime || 16;
      let vx = ((e.pageX - lastX) / dt) * 1000;
      let vy = ((e.pageY - lastY) / dt) * 1000;
      let speed = Math.hypot(vx, vy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        speed = maxSpeed;
      }
      lastTime = now;
      lastX = e.pageX;
      lastY = e.pageY;

      requestAnimationFrame(() => {
        dotCenters.forEach(({ el, x, y }) => {
          const dist = Math.hypot(x - e.pageX, y - e.pageY);
          const t = Math.max(0, 1 - dist / threshold);
          // Only repaint dots in range; reset others once (keeps it smooth
          // even with a dense field instead of recolouring every dot/frame).
          if (t > 0) {
            gsap.set(el, {
              backgroundColor: gsap.utils.interpolate(colors.base, colors.active, t),
            });
            el._lit = true;
          } else if (el._lit) {
            gsap.set(el, { backgroundColor: colors.base });
            el._lit = false;
          }

          if (speed > speedThreshold && dist < threshold && !el._inertiaApplied) {
            el._inertiaApplied = true;
            const pushX = x - e.pageX + vx * 0.005;
            const pushY = y - e.pageY + vy * 0.005;
            gsap.to(el, {
              inertia: { x: pushX, y: pushY, resistance: 750 },
              onComplete() {
                gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1,0.65)" });
                el._inertiaApplied = false;
              },
            });
          }
        });
      });
    }

    function onClick(e: MouseEvent) {
      dotCenters.forEach(({ el, x, y }) => {
        const dist = Math.hypot(x - e.pageX, y - e.pageY);
        if (dist < shockRadius && !el._inertiaApplied) {
          el._inertiaApplied = true;
          const falloff = Math.max(0, 1 - dist / shockRadius);
          const pushX = (x - e.pageX) * shockPower * falloff;
          const pushY = (y - e.pageY) * shockPower * falloff;
          gsap.to(el, {
            inertia: { x: pushX, y: pushY, resistance: 750 },
            onComplete() {
              gsap.to(el, { x: 0, y: 0, duration: 1.5, ease: "elastic.out(1,0.75)" });
              el._inertiaApplied = false;
            },
          });
        }
      });
    }

    buildGrid();

    // Reduced motion: static field, no pointer reactivity.
    if (reduced) return;

    window.addEventListener("resize", buildGrid);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("resize", buildGrid);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      gsap.killTweensOf(dots);
    };
  }, [reduced, centerHole]);

  return (
    <div className={cn("dots-grid", className)} aria-hidden>
      <div ref={containerRef} data-dots-container-init className="dots-container">
        <div className="dot" />
      </div>
    </div>
  );
}
