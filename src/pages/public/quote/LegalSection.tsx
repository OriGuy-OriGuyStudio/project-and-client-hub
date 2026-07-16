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
    <QuoteSection id="legal" title="התנאים">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ScrollText className="size-4 text-primary" /> תנאי ההתקשרות
        </div>
        <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed text-muted-foreground">
          {shown.map((clause, i) => (
            <li key={i}>{clause}</li>
          ))}
        </ol>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary"
          >
            {expanded ? "הצג פחות" : "הצג את כל התנאים"}
            <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </QuoteSection>
  );
}
