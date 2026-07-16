import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";

/** Shared vertical timeline: numbered dot nodes (a primary circle holding the
 *  index) connected by a vertical rail on the inline-start side (right in
 *  RTL) with flexible node content beside each dot. Used by both
 *  ProcessSection ("איך זה עובד", name+desc+duration per phase) and
 *  NextStepsSection ("השלבים הבאים", plain text per step) so the two
 *  numbered-list sections on the quote page read as one system instead of
 *  two different list treatments.
 *
 *  Scroll-progress behavior (adapted from Osmo Supply's "Step-by-step
 *  Timeline" template, rebuilt with framer-motion instead of their vanilla
 *  JS): the rail is a faint full-height line with a primary FILL bar inside
 *  it that scales with scroll progress (`scaleY`, origin top) as the list
 *  passes through the viewport. Each item's content starts dimmed
 *  (opacity 0.3); once the fill's leading edge passes that item's marker it
 *  becomes "active" (opacity ~0.55), and whichever item the fill most
 *  recently reached is "current" (full opacity + a soft halo ring on its
 *  marker). Marker positions are measured (like Osmo's `measureLine`) as
 *  each marker's vertical center as a fraction of the rail's own height, so
 *  activation lines up with the fill's fraction even when items have
 *  uneven heights; measurement re-runs on resize/content changes via
 *  ResizeObserver.
 *
 *  Under `prefers-reduced-motion` the fill renders fully painted (no scroll
 *  tie-in) and every item is shown fully active/visible, matching Osmo's
 *  own reduced-motion behavior , nothing on a signing document should stay
 *  artificially dimmed for a user who turned off motion. */
export function Timeline<T extends { id: string }>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.6", "end 0.6"],
  });

  const [progress, setProgress] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!reduceMotion) setProgress(v);
  });

  // Each marker's vertical center as a fraction (0-1) of the rail's own
  // height , the same coordinate space the fill bar's scaleY grows in , so
  // an item "activates" exactly when the fill visually reaches its dot.
  const [fractions, setFractions] = useState<number[]>([]);
  useEffect(() => {
    function measure() {
      const rail = railRef.current;
      if (!rail) return;
      const railRect = rail.getBoundingClientRect();
      if (railRect.height <= 0) return;
      const next: number[] = [];
      markerRefs.current.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2 - railRect.top;
        next[i] = Math.min(1, Math.max(0, center / railRect.height));
      });
      setFractions(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!items || items.length === 0) return null;

  const passed = items.map((_, i) => (reduceMotion ? true : (fractions[i] ?? 1) <= progress));
  let leadingIndex = -1;
  if (!reduceMotion) {
    passed.forEach((isPassed, i) => {
      if (isPassed) leadingIndex = i;
    });
  }

  return (
    <ol ref={listRef} className="relative space-y-7 ps-12">
      <div
        ref={railRef}
        aria-hidden="true"
        className="absolute bottom-4 top-3 w-0.5 overflow-hidden rounded-full bg-border"
        style={{ insetInlineStart: "15px" }}
      >
        <motion.div
          className="absolute inset-x-0 top-0 h-full origin-top rounded-full bg-primary"
          style={reduceMotion ? undefined : { scaleY: scrollYProgress }}
        />
      </div>
      {items.map((item, i) => {
        const isPassed = passed[i];
        const isCurrent = i === leadingIndex;
        const contentOpacity = reduceMotion
          ? "opacity-100"
          : isCurrent
            ? "opacity-100"
            : isPassed
              ? "opacity-[0.55]"
              : "opacity-[0.3]";
        return (
          <li key={item.id} className="relative">
            <span
              ref={(el) => {
                if (el) markerRefs.current.set(i, el);
                else markerRefs.current.delete(i);
              }}
              className={cn(
                "absolute -start-12 top-0 grid size-8 place-items-center rounded-full text-sm font-bold ring-4 ring-background transition-colors duration-300",
                isPassed
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground",
                isCurrent && "shadow-[0_0_0_6px] shadow-primary/15",
              )}
            >
              {i + 1}
            </span>
            <div className={cn(!reduceMotion && "transition-opacity duration-300", contentOpacity)}>
              {renderItem(item, i)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
