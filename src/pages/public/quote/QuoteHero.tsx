import { Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

/** Top-of-page hero: greeting, title, Ori's narrative (in his own voice, from
 *  the content snapshot), and a small validity line. Omits the name line
 *  gracefully when the quote has no client name on file. */
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
  return (
    <Reveal className="pt-6 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="size-3.5" /> הצעת מחיר
      </span>

      {clientName && (
        <h1 className="mt-4 font-heading text-3xl font-black sm:text-4xl">שלום {clientName},</h1>
      )}
      <p className={`font-heading text-xl font-bold text-foreground sm:text-2xl ${clientName ? "mt-2" : "mt-4"}`}>
        {title}
      </p>

      {narrative && (
        <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
          {narrative}
        </p>
      )}

      {validityLabel && <p className="mt-5 text-xs text-muted-foreground">{validityLabel}</p>}

      <p className="mt-3 text-xs font-semibold text-foreground/70">Studio Ori Guy</p>
    </Reveal>
  );
}
