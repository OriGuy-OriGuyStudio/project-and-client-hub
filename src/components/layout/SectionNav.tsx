import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FoundSection {
  id: string;
  label: string;
}

const NAV_OFFSET = 64; // clearance so the jumped-to heading clears the sticky bar

/** Read a section's chip label: an explicit `data-section` value wins, else the
 *  text of the section's own heading (so the chip always matches the section). */
function labelFor(el: HTMLElement, index: number): string {
  // A boolean `data-section` renders as "true" — treat that as "no explicit label".
  const explicit = el.getAttribute("data-section")?.trim();
  if (explicit && explicit !== "true") return explicit;
  const heading = el.querySelector("h1, h2, h3, .font-heading");
  const text = (heading?.textContent ?? "").trim();
  return text || `סעיף ${index + 1}`;
}

/**
 * Self-discovering sticky in-page navigation. Any element on the page marked with
 * `data-section` becomes a chip — its label comes from the element's heading (or an
 * explicit `data-section="…"`), so chips always match the real section titles and
 * new sections appear automatically (a MutationObserver keeps the list in sync). A
 * click smooth-scrolls + flashes the target and pins the highlight until the user
 * scrolls themselves; otherwise a scroll-spy tracks the section nearest the top.
 * Drop `<SectionNav />` on any scroll-heavy screen and mark its sections.
 */
export function SectionNav({ className }: { className?: string }) {
  const [sections, setSections] = useState<FoundSection[]>([]);
  const [active, setActive] = useState("");
  const pinned = useRef(false);

  // Discover [data-section] elements (in DOM order) + re-scan on DOM changes.
  useEffect(() => {
    let raf = 0;
    const scan = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
      const found = els.map((el, i) => {
        if (!el.id) el.id = `sec-auto-${i}`;
        return { id: el.id, label: labelFor(el, i) };
      });
      setSections((prev) =>
        prev.length === found.length &&
        prev.every((p, i) => p.id === found[i].id && p.label === found[i].label)
          ? prev
          : found
      );
    };
    scan();
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll-spy — tracks the section nearest the nav line (released by user scroll).
  useEffect(() => {
    const onScroll = () => {
      if (pinned.current) return;
      const line = NAV_OFFSET + 12;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0]?.id ?? "";

      if (atBottom) {
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

    const release = () => {
      pinned.current = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(e.key))
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
    setActive(id);
    pinned.current = true; // hold the selection until the user scrolls themselves
    window.setTimeout(() => {
      el.classList.remove("section-flash");
      void el.offsetWidth;
      el.classList.add("section-flash");
      window.setTimeout(() => el.classList.remove("section-flash"), 2700);
    }, 450);
  }

  if (sections.length < 2) return null; // nothing worth navigating

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
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95",
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
