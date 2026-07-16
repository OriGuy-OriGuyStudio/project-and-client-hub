import { Sparkles } from "lucide-react";
import StaggeredText from "@/components/reactbits/StaggeredText";
import { Reveal } from "./Reveal";

/** The generic default title admins leave in place when they never bothered
 *  to customize it. Shown redundantly under the greeting + the "הצעת מחיר"
 *  pill otherwise, so it's skipped as its own line whenever it's exactly
 *  this string , a custom title (e.g. "הצעת מחיר עבור דור עמרם") still
 *  renders as always. */
const GENERIC_TITLE = "הצעת מחיר";

/** Top-of-page hero: greeting, title, Ori's narrative (in his own voice, from
 *  the content snapshot), and a small validity line. Omits the name line
 *  gracefully when the quote has no client name on file. Exactly one h1 in
 *  every branch: a custom title is always the h1; the generic default title
 *  is skipped as redundant and the greeting becomes the h1 instead , unless
 *  there's no client name either, in which case the generic title is kept as
 *  the h1 (the page needs an h1 from somewhere). The headline animates in
 *  word-by-word (StaggeredText), gated on `prefers-reduced-motion` inside
 *  that component , this is a signing document, not a show. The ambient
 *  light-ray backdrop (SideRays) lives in QuoteView's Shell now, as a
 *  full-bleed backdrop behind the whole page, not scoped to this card. */
export function QuoteHero({
  clientName,
  title,
  narrative,
  validityLabel,
}: {
  clientName: string | null;
  title: string;
  narrative: string;
  validityLabel: string | null;
}) {
  const isGenericTitle = title.trim() === GENERIC_TITLE;
  const showTitleLine = !isGenericTitle || !clientName;

  return (
    <Reveal className="pt-6 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles aria-hidden="true" className="size-3.5" /> הצעת מחיר
      </span>

      {/* The greeting is deliberately static (no word-stagger) , the owner
         found the animated client name distracting on a signing document. */}
      {clientName &&
        (showTitleLine ? (
          <p className="mt-4 break-words font-heading text-3xl font-black sm:text-4xl">שלום {clientName},</p>
        ) : (
          <h1 className="mt-4 break-words font-heading text-3xl font-black sm:text-4xl">שלום {clientName},</h1>
        ))}
      {/* The page's single h1: the custom title when there is one, or (when
         the title is the generic default) the greeting above takes the h1
         role instead and this line is skipped entirely. If there's no
         client name to promote to h1, the generic title is kept so the page
         still has exactly one h1. */}
      {showTitleLine && (
        <StaggeredText
          as="h1"
          text={title}
          segmentBy="words"
          direction="top"
          blur
          delay={70}
          exitOnScrollOut={false}
          className={`justify-center break-words font-heading text-xl font-bold text-foreground sm:text-2xl ${clientName ? "mt-2" : "mt-4"}`}
        />
      )}

      {narrative && (
        <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-muted-foreground">
          {narrative}
        </p>
      )}

      {validityLabel && <p className="mt-5 text-sm text-muted-foreground">{validityLabel}</p>}

      <p className="mt-3 text-xs font-semibold text-foreground/70">Ori Guy Studio</p>
    </Reveal>
  );
}
