import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type QuoteNavItem = { id: string; label: string };

/** Small sticky nav row of anchor links to whichever content sections the
 *  quote actually has (a quote with no FAQ just doesn't get a FAQ link).
 *  Highlights the section currently in view via IntersectionObserver; a
 *  best-effort touch, not load-bearing, so it fails silently. */
export function QuoteMiniNav({ items }: { items: QuoteNavItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) => (a.intersectionRatio > b.intersectionRatio ? a : b));
        setActive(top.target.id);
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  if (items.length === 0) return null;

  return (
    <nav
      dir="rtl"
      aria-label="ניווט בהצעה"
      className="sticky top-0 z-20 -mx-4 mt-8 overflow-x-auto border-y border-border/70 bg-background/85 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border"
    >
      <ul className="flex w-max min-w-full items-center justify-center gap-1 text-xs sm:gap-2">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={cn(
                "block whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-colors",
                active === it.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
