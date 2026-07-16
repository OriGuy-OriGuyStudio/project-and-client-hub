import { Quote } from "lucide-react";
import type { QuoteTestimonial } from "@/lib/quote-v2";
import { Reveal } from "./Reveal";

/** A single client testimonial, when the admin attached one to the quote.
 *  No section id / mini-nav entry (it's a supporting beat, not a destination
 *  someone jumps to), so it just sits between "מתנות" and the FAQ. */
export function TestimonialSection({ testimonial }: { testimonial: QuoteTestimonial | null }) {
  if (!testimonial || !testimonial.quote) return null;
  return (
    <Reveal className="py-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <Quote className="mx-auto size-6 text-primary/60" />
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">{testimonial.quote}</p>
        <p className="mt-4 text-sm font-semibold text-foreground">
          {testimonial.name}
          {testimonial.role && <span className="font-normal text-muted-foreground"> · {testimonial.role}</span>}
        </p>
      </div>
    </Reveal>
  );
}
