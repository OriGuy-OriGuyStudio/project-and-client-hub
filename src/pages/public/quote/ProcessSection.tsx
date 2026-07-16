import type { QuotePhase } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";

/** "איך זה עובד" , the build phases as a numbered vertical timeline. */
export function ProcessSection({ phases }: { phases: QuotePhase[] }) {
  if (!phases || phases.length === 0) return null;
  return (
    <QuoteSection id="process" title="איך זה עובד">
      <ol className="relative space-y-4 ps-10">
        <div
          aria-hidden
          className="absolute bottom-4 top-3 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent"
          style={{ insetInlineStart: "15px" }}
        />
        {phases.map((p, i) => (
          <li key={p.id} className="relative">
            <span className="absolute -start-10 top-0 grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base font-semibold text-foreground">{p.name}</p>
                {p.duration && <p className="text-xs text-muted-foreground">{p.duration}</p>}
              </div>
              {p.desc && <p className="mt-1 text-base leading-relaxed text-muted-foreground">{p.desc}</p>}
            </div>
          </li>
        ))}
      </ol>
    </QuoteSection>
  );
}
