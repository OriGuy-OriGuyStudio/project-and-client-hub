import { useMemo } from "react";
import { Quote, Star } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { QuoteTestimonial } from "@/lib/quote-v2";
import BlurHighlight from "@/components/reactbits/BlurHighlight";
import { Reveal } from "./Reveal";

/** Candidate praise words/phrases , only the ones actually present in a given
 *  testimonial's text get highlighted (see `useMemo` below), so this list can
 *  stay broad without over-highlighting a shorter quote. */
const HIGHLIGHT_CANDIDATES = [
  "ממליץ",
  "ממליצה",
  "מעולה",
  "מקצועי",
  "מקצועיים",
  "מקצועית",
  "פגז",
  "מדהים",
  "מושלם",
  "חוויה מעולה",
  "מעבר למה שציפיתי",
];

/** Translucent brand-green highlight, same hex as `--primary` (dark theme)
 *  in brand-tokens.css. BlurHighlight takes a raw color prop by design (its
 *  own component API), this is the one place hex is allowed outside CSS. */
const HIGHLIGHT_COLOR = "color-mix(in srgb, #b4d670 35%, transparent)";

/** A single client testimonial, when the admin attached one to the quote.
 *  No section id / mini-nav entry (it's a supporting beat, not a destination
 *  someone jumps to), so it just sits between "מתנות" and the FAQ. The 5-star
 *  row is always full , the testimonial content has no rating field, this is
 *  a static trust cue, not a per-quote rating. */
export function TestimonialSection({ testimonial }: { testimonial: QuoteTestimonial | null }) {
  const reduceMotion = useReducedMotion();

  const highlightedBits = useMemo(() => {
    const quote = testimonial?.quote ?? "";
    return HIGHLIGHT_CANDIDATES.filter((bit) => quote.includes(bit));
  }, [testimonial?.quote]);

  if (!testimonial || !testimonial.quote) return null;
  return (
    <Reveal className="py-8">
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <Quote
          aria-hidden
          className="pointer-events-none absolute -top-3 start-4 size-16 -scale-x-100 text-primary/10 sm:size-20"
          strokeWidth={1}
        />
        <div role="img" aria-label="5 כוכבים" className="relative flex items-center justify-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} aria-hidden="true" className="size-4 fill-primary text-primary" />
          ))}
        </div>
        {reduceMotion ? (
          <p className="relative mt-3 text-base leading-relaxed text-foreground">{testimonial.quote}</p>
        ) : (
          <BlurHighlight
            className="relative mt-3 text-base leading-relaxed text-foreground"
            highlightedBits={highlightedBits}
            highlightColor={HIGHLIGHT_COLOR}
            highlightClassName="font-semibold"
            viewportOptions={{ once: true, amount: 0.4 }}
          >
            {testimonial.quote}
          </BlurHighlight>
        )}
        <p className="relative mt-4 text-sm font-semibold text-foreground">
          {testimonial.name}
          {testimonial.role && <span className="font-normal text-muted-foreground"> · {testimonial.role}</span>}
        </p>
      </div>
    </Reveal>
  );
}
