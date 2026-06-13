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
  // After a click we PIN the highlight to the clicked chip and stop the scroll-spy
  // from overriding it, until the user scrolls on their own (wheel/touch/keys).
  // This is reliable even when the smooth-scroll is long or the target sits at the
  // bottom and can't reach the top line.
  const pinned = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (pinned.current) return; // a click selection is being honoured
      const line = NAV_OFFSET + 12;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0]?.id ?? "";

      if (atBottom) {
        // Bottom sections can't reach the line, so pick the one whose top is
        // closest to the line (the one you're actually looking at).
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
        // The section whose top is nearest the line from above — by position, not
        // array order, so it stays correct across the parallel columns.
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

    // The user taking over scrolling releases the pin so the spy resumes.
    const release = () => {
      pinned.current = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(
          e.key
        )
      )
        release();
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
    };
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setActive(id); // highlight immediately…
    pinned.current = true; // …and hold it until the user scrolls themselves
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
