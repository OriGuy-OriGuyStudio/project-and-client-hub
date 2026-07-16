// Quote builder , one scope section (עמודים / פיצ'רים / מודולים / אוטומציות).
// Renders the catalog rows of a single `kind`, toggled on/off into the quote's
// `content.scope`; a selected row shows an editable ₪ value that patches only
// that scope item (never the shared catalog row). See QuoteBuilder.tsx.

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { shekel, type ScopeItem } from "@/lib/quote-pricing";
import type { QuoteCatalogRow } from "@/types/database";

/** The three mutually-exclusive per-item states: counts in the price anchor,
 *  included at no extra cost (value-stack, ₪0 to the anchor), or a
 *  client-selectable add-on (excluded from the anchor). */
export type ScopeItemMode = "included" | "free" | "optional";

function modeOf(item: ScopeItem | undefined): ScopeItemMode {
  if (item?.free) return "free";
  if (item?.optional) return "optional";
  return "included";
}

export const MODE_OPTIONS: { value: ScopeItemMode; label: string }[] = [
  { value: "included", label: "כלול במחיר" },
  { value: "free", label: "כלול ללא עלות" },
  { value: "optional", label: "תוספת אופציונלית" },
];

export function ScopeSection({
  title,
  rows,
  scope,
  disabled,
  onToggle,
  onValueChange,
  onSetMode,
}: {
  title: string;
  rows: QuoteCatalogRow[];
  scope: ScopeItem[];
  disabled?: boolean;
  onToggle: (row: QuoteCatalogRow) => void;
  onValueChange: (itemId: string, value: number) => void;
  onSetMode: (itemId: string, mode: ScopeItemMode) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const item = scope.find((it) => it.id === row.id);
          const selected = !!item;
          const mode = modeOf(item);
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
                  <span className="flex flex-col items-start gap-0.5">
                    <span className={cn("font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
                      {row.label}
                    </span>
                    {row.description && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{row.description}</span>
                    )}
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
                <div className="flex flex-wrap items-center gap-1 self-start rounded-lg border border-border bg-field p-0.5 text-xs">
                  {MODE_OPTIONS.map((opt) => {
                    const active = mode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => !active && onSetMode(row.id, opt.value)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md px-2 py-1 font-medium transition-colors",
                          active
                            ? "border border-primary bg-primary/15 text-primary"
                            : "border border-transparent bg-field text-muted-foreground",
                          disabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
