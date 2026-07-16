import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { QuoteFaq } from "@/lib/quote-v2";
import { cn } from "@/lib/utils";
import { QuoteSection } from "./Reveal";

/** A single accordion row. Uses the CSS grid-template-rows 0fr/1fr trick for
 *  a smooth height animation with no JS height measurement , a plain button
 *  (not native <details>) so we control the transition, but keeps native
 *  keyboard semantics (aria-expanded/aria-controls) and the same focus ring
 *  as the rest of the page. Under `prefers-reduced-motion` the transition is
 *  dropped entirely so open/close is instant. */
function FaqItem({ faq, reduceMotion }: { faq: QuoteFaq; reduceMotion: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${faq.id}`;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-start text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {faq.q}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !reduceMotion && "duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={faq.q}
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: reduceMotion ? "none" : "grid-template-rows 0.3s ease",
        }}
      >
        <div className="overflow-hidden">
          <p className="pt-2 text-base leading-relaxed text-muted-foreground">{faq.a}</p>
        </div>
      </div>
    </div>
  );
}

/** "שאלות ותשובות" , an animated accordion (open/close height transition),
 *  keyboard/screen-reader accessible via aria-expanded + aria-controls, with
 *  the same focus ring used everywhere else on the page. */
export function FaqSection({ faq }: { faq: QuoteFaq[] }) {
  const reduceMotion = useReducedMotion();
  if (!faq || faq.length === 0) return null;
  return (
    <QuoteSection id="faq" title="שאלות ששואלים אותי הרבה">
      <div className="space-y-2">
        {faq.map((f) => (
          <FaqItem key={f.id} faq={f} reduceMotion={!!reduceMotion} />
        ))}
      </div>
    </QuoteSection>
  );
}
