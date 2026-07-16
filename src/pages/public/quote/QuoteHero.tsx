import { Sparkles } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import StaggeredText from "@/components/reactbits/StaggeredText";
import SideRays from "@/components/reactbits/SideRays";
import { Reveal } from "./Reveal";

/** Top-of-page hero: greeting, title, Ori's narrative (in his own voice, from
 *  the content snapshot), and a small validity line. Omits the name line
 *  gracefully when the quote has no client name on file. The title animates
 *  in word-by-word (StaggeredText) and a subtle light-ray backdrop
 *  (SideRays) sits behind everything; both are skipped entirely under
 *  `prefers-reduced-motion` , this is a signing document, not a show. */
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
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden">
      {!reduceMotion && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <SideRays
            speed={1.2}
            rayColor1="#b4d670"
            rayColor2="#96c8ff"
            intensity={1.1}
            spread={1.6}
            origin="top-right"
            saturation={1.1}
            blend={0.6}
            falloff={1.8}
            opacity={0.35}
          />
        </div>
      )}

      <Reveal className="relative z-10 pt-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles aria-hidden="true" className="size-3.5" /> הצעת מחיר
        </span>

        {clientName && (
          <p className="mt-4 break-words font-heading text-3xl font-black sm:text-4xl">שלום {clientName},</p>
        )}
        {/* The quote title is the page's single h1 , always present, unlike the
           greeting above which depends on a client name being on file. */}
        <StaggeredText
          as="h1"
          text={title}
          segmentBy="words"
          direction="top"
          blur
          delay={70}
          exitOnScrollOut={false}
          className={`break-words font-heading text-xl font-bold text-foreground sm:text-2xl ${clientName ? "mt-2" : "mt-4"}`}
        />

        {narrative && (
          <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-muted-foreground">
            {narrative}
          </p>
        )}

        {validityLabel && <p className="mt-5 text-sm text-muted-foreground">{validityLabel}</p>}

        <p className="mt-3 text-xs font-semibold text-foreground/70">Studio Ori Guy</p>
      </Reveal>
    </div>
  );
}
