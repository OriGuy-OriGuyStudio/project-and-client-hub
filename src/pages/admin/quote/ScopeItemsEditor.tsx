// Quote builder , free-form editor for the items ALREADY in the quote's
// scope. The catalog pickers (ScopeSection) only toggle items in and out;
// this card is where the admin edits what the client will actually read:
// per-quote label + description overrides (never touching the shared
// catalog), value, mode, removal, and fully custom items that don't come
// from the catalog at all (e.g. a GoHighLevel-specific deliverable). Custom
// items must carry one of the type's kinds, or the public IncludedSection
// won't render them , hence the per-kind add buttons.

import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ScopeItem, ScopeItemKind } from "@/lib/quote-pricing";
import { MODE_OPTIONS, type ScopeItemMode } from "./ScopeSection";

function modeOf(item: ScopeItem): ScopeItemMode {
  if (item.free) return "free";
  if (item.optional) return "optional";
  return "included";
}

export function ScopeItemsEditor({
  items,
  sections,
  disabled,
  onPatch,
  onSetMode,
  onRemove,
  onAddCustom,
}: {
  items: ScopeItem[];
  /** The quote type's scope kinds + Hebrew titles (KIND_SECTIONS entry). */
  sections: { kind: ScopeItemKind; title: string }[];
  disabled?: boolean;
  onPatch: (itemId: string, patch: Partial<ScopeItem>) => void;
  onSetMode: (itemId: string, mode: ScopeItemMode) => void;
  onRemove: (itemId: string) => void;
  onAddCustom: (kind: ScopeItemKind) => void;
}) {
  // The subtype base line is managed by the subtype picker (its label doubles
  // as the chosen subtype), so it's shown here as editable too , renaming it
  // renames the "הבסיס" line the client sees , but without a remove button.
  const editable = items;

  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">פריטי ההצעה, עריכה חופשית</p>
        <p className="text-xs text-muted-foreground">
          מה שכתוב כאן הוא בדיוק מה שהלקוח רואה. עריכה משפיעה רק על ההצעה הזו, לא על הקטלוג.
        </p>
      </div>

      {editable.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          עדיין אין פריטים בהצעה. בחר מהקטלוג למטה או הוסף פריט מותאם.
        </p>
      )}

      <div className="space-y-2">
        {editable.map((item) => (
          <div key={item.id} className="space-y-2 rounded-xl border border-border bg-field p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.label}
                onChange={(e) => onPatch(item.id, { label: e.target.value })}
                placeholder="שם הפריט (מוצג ללקוח)"
                disabled={disabled}
                className="h-9 flex-1 font-medium"
                aria-label="שם הפריט"
              />
              <Input
                type="number"
                value={item.value}
                onChange={(e) => onPatch(item.id, { value: Number(e.target.value) || 0 })}
                disabled={disabled}
                className="h-9 w-24 shrink-0 text-end text-sm"
                aria-label={`ערך עבור ${item.label || "פריט"}`}
              />
              {item.kind !== "subtype" && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                  aria-label={`הסר את ${item.label || "הפריט"}`}
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Input
              value={item.desc ?? ""}
              onChange={(e) => onPatch(item.id, { desc: e.target.value || undefined })}
              placeholder="הסבר קצר ללקוח (אופציונלי)"
              disabled={disabled}
              className="h-9 text-sm"
              aria-label={`הסבר עבור ${item.label || "פריט"}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                {item.kind === "subtype" ? "הבסיס" : sections.find((s) => s.kind === item.kind)?.title ?? item.kind}
              </span>
              {item.kind !== "subtype" && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background/40 p-0.5 text-xs">
                  {MODE_OPTIONS.map((opt) => {
                    const active = modeOf(item) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => !active && onSetMode(item.id, opt.value)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md px-2 py-1 font-medium transition-colors",
                          active
                            ? "border border-primary bg-primary/15 text-primary"
                            : "border border-transparent text-muted-foreground",
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
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {sections.map((s) => (
          <button
            key={s.kind}
            type="button"
            disabled={disabled}
            onClick={() => onAddCustom(s.kind)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <Plus className="size-4" />
            {sections.length > 1 ? `פריט מותאם (${s.title})` : "פריט מותאם אישית"}
          </button>
        ))}
      </div>
    </Card>
  );
}
