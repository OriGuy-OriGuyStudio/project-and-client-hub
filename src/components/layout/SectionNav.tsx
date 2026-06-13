import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface NavSection {
  id: string;
  label: string;
}

const NAV_OFFSET = 64; // clearance so the jumped-to heading clears the sticky bar

/**
 * Sticky in-page section navigation for long, scroll-heavy screens. A horizontal,
 * swipeable row of chips that smooth-scrolls to each section and briefly flashes a
 * ring on the target card so it's clear where you landed. The active chip tracks
 * the section nearest the top as you scroll. Sticks to the top once the
 * (non-sticky) header scrolls away. Sections are matched by element id.
 */
export function SectionNav({
  sections,
  className,
}: {
  sections: NavSection[];
  className?: string;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  // While a click-scroll is in flight, the click's choice wins over scroll-spy.
  const lockUntil = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockUntil.current) return; // a click is driving the highlight
      const line = NAV_OFFSET + 12;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0]?.id ?? "";

      if (atBottom) {
        // Bottom sections can't reach the line, so pick the one whose top is
        // CLOSEST to the line (the one you're actually looking at) — not the last.
        let best = Infinity;
        for (const s of sections) {
          const el = document.getElementById(s.id);
          if (!el) continue;
          const dist = Math.abs(el.getBoundingClientRect().top - line);
          if (dist < best) {
            best = dist;
            current = s.id;
          }
        }
      } else {
        // The section whose top is nearest the line from above. By position — not
        // array order — so it stays correct across the parallel columns.
        let bestTop = -Infinity;
        for (const s of sections) {
          const el = document.getElementById(s.id);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top <= line && top > bestTop) {
            bestTop = top;
            current = s.id;
          }
        }
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setActive(id); // highlight immediately…
    lockUntil.current = Date.now() + 900; // …and keep it through the smooth-scroll
    // Flash AFTER the smooth-scroll has settled, so it's still visible on arrival.
    window.setTimeout(() => {
      el.classList.remove("section-flash");
      void el.offsetWidth; // restart the animation if re-triggered
      el.classList.add("section-flash");
      window.setTimeout(() => el.classList.remove("section-flash"), 2700);
    }, 450);
  }

  return (
    <nav
      className={cn(
        "sticky top-0 z-30 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6",
        className
      )}
    >
      <div className="flex gap-2 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
