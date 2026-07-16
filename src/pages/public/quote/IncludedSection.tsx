import { Check, Gift } from "lucide-react";
import { breakdownForFinal, shekel, type QuoteType, type ScopeItem, type ScopeItemKind } from "@/lib/quote-pricing";
import { QuoteSection } from "./Reveal";

/** Which scope kinds get their own group + Hebrew title, per quote type, in
 *  display order. The `subtype` kind is handled separately as the base line,
 *  never as its own group here (mirrors KIND_SECTIONS in the admin builder,
 *  src/pages/admin/quote/QuoteBuilder.tsx, kept local since the public page
 *  must not import from the admin tree). */
const KIND_GROUPS: Record<QuoteType, { kind: ScopeItemKind; title: string }[]> = {
  website: [
    { kind: "page", title: "עמודים" },
    { kind: "feature", title: "פיצ'רים" },
  ],
  system: [{ kind: "module", title: "מודולים" }],
  automation: [{ kind: "automation", title: "אוטומציות" }],
};

function IncludedRow({ item, price }: { item: ScopeItem; price: number | null }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-xl bg-background/50 px-3.5 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Check className="size-3" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          {item.desc && <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>}
        </div>
      </div>
      {item.free ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          כלול
        </span>
      ) : price != null ? (
        <span className="shrink-0 text-sm font-semibold text-foreground">{shekel(price)}</span>
      ) : null}
    </li>
  );
}

/** "מה אתם מקבלים" , the INCLUDED scope (never the optional extras, those are
 *  Task 5's pricing picker). Renders nothing when there's no included scope
 *  at all, which shouldn't happen for a real quote but keeps the section
 *  honest about "skip when empty". */
export function IncludedSection({
  type,
  scope,
  finalPrice,
  showBreakdown,
}: {
  type: QuoteType;
  scope: ScopeItem[];
  finalPrice: number;
  showBreakdown: boolean;
}) {
  const included = (scope ?? []).filter((it) => !it.optional);
  if (included.length === 0) return null;

  const subtypeItem = included.find((it) => it.kind === "subtype");
  const groups = KIND_GROUPS[type]
    .map((g) => ({ ...g, items: included.filter((it) => it.kind === g.kind) }))
    .filter((g) => g.items.length > 0);

  const priceById = new Map<string, number>();
  if (showBreakdown) {
    const priced = breakdownForFinal(
      scope.filter((it) => !it.optional && !it.free),
      finalPrice,
    );
    priced.forEach((line) => priceById.set(line.id, line.price));
  }

  return (
    <QuoteSection id="included" title="מה אתם מקבלים" intro="ככה נראה ההיקף שסיכמנו.">
      <div className="space-y-4">
        {subtypeItem && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Gift className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">הבסיס</p>
              <p className="text-sm font-semibold text-foreground">{subtypeItem.label}</p>
              {subtypeItem.desc && <p className="mt-0.5 text-xs text-muted-foreground">{subtypeItem.desc}</p>}
            </div>
            {priceById.has(subtypeItem.id) && (
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {shekel(priceById.get(subtypeItem.id) ?? 0)}
              </span>
            )}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.kind} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">{g.title}</p>
            <ul className="space-y-2">
              {g.items.map((it) => (
                <IncludedRow key={it.id} item={it} price={priceById.get(it.id) ?? null} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </QuoteSection>
  );
}
