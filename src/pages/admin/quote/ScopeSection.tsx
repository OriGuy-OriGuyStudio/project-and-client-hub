// Quote builder , one scope section (עמודים / פיצ'רים / מודולים / אוטומציות).
// Renders the catalog rows of a single `kind`, toggled on/off into the quote's
// `content.scope`; a selected row shows an editable ₪ value that patches only
// that scope item (never the shared catalog row). See QuoteBuilder.tsx.

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { shekel, type ScopeItem } from "@/lib/quote-pricing";
import type { QuoteCatalogRow } from "@/types/database";

export function ScopeSection({
  title,
  rows,
  scope,
  disabled,
  onToggle,
  onValueChange,
  onToggleOptional,
}: {
  title: string;
  rows: QuoteCatalogRow[];
  scope: ScopeItem[];
  disabled?: boolean;
  onToggle: (row: QuoteCatalogRow) => void;
  onValueChange: (itemId: string, value: number) => void;
  onToggleOptional: (itemId: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const item = scope.find((it) => it.id === row.id);
          const selected = !!item;
          const isOptional = !!item?.optional;
          return (
            <div
              key={row.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors",
                selected ? "border-primary/50 bg-primary/5" : "border-border bg-field"
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(row)}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-1 items-center justify-between gap-2 text-start text-sm",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <span className={cn("font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
                    {row.label}
                  </span>
                  {!selected && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {shekel(Number(row.base_price ?? 0))}
                    </span>
                  )}
                </button>
                {selected && item && (
                  <Input
                    type="number"
                    value={item.value}
                    onChange={(e) => onValueChange(item.id, Number(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 w-24 shrink-0 text-end text-sm"
                    aria-label={`ערך עבור ${row.label}`}
                  />
                )}
              </div>
              {selected && (
                <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-field p-0.5 text-xs">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => isOptional && onToggleOptional(row.id)}
                    aria-pressed={!isOptional}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition-colors",
                      !isOptional
                        ? "border border-primary bg-primary/15 text-primary"
                        : "border border-transparent bg-field text-muted-foreground",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    כלול במחיר
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !isOptional && onToggleOptional(row.id)}
                    aria-pressed={isOptional}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition-colors",
                      isOptional
                        ? "border border-primary bg-primary/15 text-primary"
                        : "border border-transparent bg-field text-muted-foreground",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    תוספת אופציונלית
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
