import { useState } from "react";
import { ChevronDown, ScrollText } from "lucide-react";
import { QuoteSection } from "./Reveal";

/** "התנאים" , legal clauses, numbered. Collapsed to the first few by default
 *  ("הצג את כל התנאים" expands the rest) but the FULL text is always present
 *  in the DOM before signing, never fetched lazily , this is what the client
 *  is agreeing to. */
const COLLAPSED_COUNT = 3;

export function LegalSection({ legal }: { legal: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!legal || legal.length === 0) return null;

  const hasMore = legal.length > COLLAPSED_COUNT;
  const shown = expanded ? legal : legal.slice(0, COLLAPSED_COUNT);

  return (
    <QuoteSection id="legal" title="התנאים, בגובה העיניים">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <ScrollText aria-hidden="true" className="size-4 text-primary" /> תנאי ההתקשרות
        </h3>
        <ol className="list-decimal space-y-2 ps-5 text-base leading-relaxed text-foreground/90 marker:text-primary marker:font-semibold">
          {shown.map((clause, i) => (
            <li key={i}>{clause}</li>
          ))}
        </ol>
        {hasMore && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex min-h-10 items-center gap-1 rounded-md px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {expanded ? "הצג פחות" : "הצג את כל התנאים"}
            <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </QuoteSection>
  );
}
