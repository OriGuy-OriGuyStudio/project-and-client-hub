import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  Gift,
  HelpCircle,
  ListChecks,
  PenLine,
  Route,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { shekel } from "@/lib/quote-pricing";
import { cn } from "@/lib/utils";
import { burstDots } from "@/lib/burst-dots";
import type { QuoteNavItem } from "./QuoteMiniNav";

/** One icon per section anchor id (see QuoteSection id props across the
 *  quote/* section components). Falls back to Sparkles for any id this map
 *  doesn't know about, so a future section never renders with no icon at all. */
const NAV_ICONS: Record<string, LucideIcon> = {
  included: ListChecks,
  pricing: Wallet,
  why: Sparkles,
  process: Route,
  bonuses: Gift,
  faq: HelpCircle,
  legal: FileText,
  sign: PenLine,
};

/** Desktop-only (`lg+`) sticky side panel: brand header, section nav with
 *  scroll-spy, a live mini price summary, and a quick-sign CTA , inspired by
 *  a competitor's quote layout Ori liked. Renders `null` when there are no
 *  nav items (mirrors `QuoteMiniNav`'s own empty-state behavior) so the
 *  two-column layout in `QuoteView` never reserves space for an empty aside.
 *
 *  Scroll-spy is a second, independent IntersectionObserver from
 *  `QuoteMiniNav`'s (same sections, same rootMargin) rather than a shared
 *  one , the two navs are mutually exclusive by breakpoint (`lg:hidden` /
 *  `hidden lg:block`) so only one is ever visible, and duplicating the
 *  lightweight observer keeps each component self-contained. */
export function SideNav({
  items,
  net,
  total,
  tierName,
  tierPrice,
  signed,
}: {
  items: QuoteNavItem[];
  net: number;
  total: number;
  tierName?: string | null;
  tierPrice?: number | null;
  signed: boolean;
}) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const reduceMotion = useReducedMotion();

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

  // Nav click updates the highlight immediately (don't wait on IO, which can
  // lag a smooth-scroll's whole duration) and scrolls smoothly to the anchor,
  // falling back to an instant jump under prefers-reduced-motion. Also fires
  // the Osmo-style physics click-dot burst from the click point (`burstDots`
  // no-ops under prefers-reduced-motion, same as the smooth-scroll fallback).
  function goTo(id: string, e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    burstDots(e.clientX, e.clientY);
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  if (items.length === 0) return null;

  return (
    <aside className="hidden w-72 shrink-0 self-start lg:sticky lg:top-6 lg:block">
      <nav
        dir="rtl"
        aria-label="ניווט בהצעה"
        className="rounded-2xl border border-border/70 bg-card p-4"
      >
        <div className="mb-3">
          <p className="font-heading text-sm font-bold text-foreground">Ori Guy Studio</p>
          <p className="text-xs text-muted-foreground">הצעת מחיר</p>
        </div>

        <ul className="space-y-0.5">
          {items.map((it) => {
            const Icon = NAV_ICONS[it.id] ?? Sparkles;
            const isActive = active === it.id;
            return (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={(e) => goTo(it.id, e)}
                  className={cn(
                    "flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{it.label}</span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="my-4 h-px bg-border/70" />

        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">סה"כ (לפני מע"מ)</p>
          <p className="font-heading text-2xl font-black text-primary">{shekel(net)}</p>
          <p className="text-xs text-muted-foreground">כולל מע"מ: {shekel(total)}</p>
          {tierName && (
            <p className="pt-1 text-xs font-semibold text-primary">
              + {tierName} {shekel(tierPrice ?? 0)}/חודש
            </p>
          )}
        </div>

        <div className="mt-4">
          {signed ? (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              ההצעה אושרה ✓
            </p>
          ) : (
            <Button asChild className="w-full">
              <a href="#sign" onClick={(e) => goTo("sign", e)}>
                לאישור וחתימה
              </a>
            </Button>
          )}
        </div>
      </nav>
    </aside>
  );
}
