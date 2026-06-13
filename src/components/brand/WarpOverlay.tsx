import { useEffect, useState } from "react";
import { Starfield } from "@/components/ui/starfield-1";
import { onWarp } from "@/lib/warp";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const HOLD_MS = 5000; // full warp
const FADE_MS = 1300; // landing fade-out

/**
 * The "warp" easter egg. When triggered (Orion wordmark in the footer), it drops
 * a full-screen brand-green hyperspace starfield over everything and rattles the
 * whole app like a cockpit for ~6s, then fades out ("lands") back to normal.
 * Skipped entirely for reduced-motion users.
 */
export function WarpOverlay() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    return onWarp(() => {
      if (reduced) return;
      setActive(true); // no-op if already running → ignores re-triggers
    });
  }, [reduced]);

  useEffect(() => {
    if (!active) return;
    const root = document.getElementById("root");
    root?.classList.add("warp-shake");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const fadeAt = window.setTimeout(() => setFading(true), HOLD_MS);
    const endAt = window.setTimeout(() => {
      setActive(false);
      setFading(false);
    }, HOLD_MS + FADE_MS);

    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(endAt);
      root?.classList.remove("warp-shake");
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[10001] transition-opacity ease-out",
        fading ? "opacity-0" : "opacity-100"
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <Starfield
        starColor="rgba(180,214,112,1)"
        bgColor="rgba(11,10,16,1)"
        hyperspace
        speed={1.6}
        warpFactor={16}
        opacity={0.12}
        quantity={640}
      />
    </div>
  );
}
