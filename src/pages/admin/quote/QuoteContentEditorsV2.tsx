// Quote system v2 , content editors (Task 6 of the v2 rebuild).
// Covers every QuoteContentV2 field not already handled by the shell (Task 4:
// type/subtype/scope) or the price panel (Task 5: final_price/options). The
// shared list-row primitives (EditorShell/DelBtn/Empty + the typed editors)
// are exported so QuoteDefaultsV2.tsx can reuse them for the studio-wide
// defaults subset, DRY per the brief.
// Adapted from the deleted v1 `components/quote/QuoteContentEditors.tsx`
// (see git show b1a5a79~1:...) to the v2 content shape.
// See .superpowers/sdd/task-6-brief.md and lib/quote-v2.ts.

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { shekel, type QuoteType } from "@/lib/quote-pricing";
import {
  newId,
  type MaintenanceTierSnapshot,
  type QuoteBonus,
  type QuoteContentV2,
  type QuoteDiff,
  type QuoteDiscount,
  type QuoteFaq,
  type QuotePayment,
  type QuotePhase,
  type QuoteStep,
  type QuoteTestimonial,
  type QuoteUpsell,
} from "@/lib/quote-v2";
import { useMaintenanceTiers } from "@/hooks/useQuotesV2";
import { quoteAiCopy, quoteAiUpsells } from "@/lib/quote-ai";
import { toast, toastError } from "@/hooks/use-toast";
import type { QuoteCatalogRow, QuoteMaintenanceTierRow } from "@/types/database";

/* ---------- shared row-editor primitives (reused by QuoteDefaultsV2) ---------- */

export function EditorShell({
  title,
  subtitle,
  onAdd,
  disabled,
  children,
}: {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {onAdd && !disabled && (
          <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-4" /> הוסף
          </Button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

export function DelBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  if (disabled) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-destructive"
      onClick={onClick}
      aria-label="מחק"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/* ---------- differentiators (title + desc) ---------- */
export function DiffsEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteDiff[];
  onChange: (v: QuoteDiff[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  return (
    <EditorShell
      title="הבידול שלי (למה אני)"
      subtitle="הסיבות לבחור בך. מוצג ללקוח ככרטיסים."
      disabled={disabled}
      onAdd={() => onChange([...items, { id: newId("diff"), title: "", desc: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <Input
              value={it.title}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              placeholder="כותרת"
              className="h-9"
              disabled={disabled}
            />
            <Textarea
              value={it.desc ?? ""}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
              placeholder="תיאור קצר"
              rows={2}
              disabled={disabled}
            />
          </div>
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין בידולים." />}
    </EditorShell>
  );
}

/* ---------- phases (name + desc + soft duration) ---------- */
export function PhasesEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuotePhase[];
  onChange: (v: QuotePhase[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  return (
    <EditorShell
      title="שלבים ולו״ז"
      subtitle="משך הזמן אופציונלי (טקסט חופשי כמו ״כשבוע״, או ריק אם עדיין לא ידוע)."
      disabled={disabled}
      onAdd={() => onChange([...items, { id: newId("phase"), name: "", desc: "", duration: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {i + 1}
          </span>
          <div className="flex-1 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
              <Input
                value={it.name}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="שם השלב"
                className="h-9"
                disabled={disabled}
              />
              <Input
                value={it.duration ?? ""}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))}
                placeholder="משך (אופציונלי)"
                className="h-9"
                disabled={disabled}
              />
            </div>
            <Textarea
              value={it.desc ?? ""}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
              placeholder="מה קורה בשלב הזה"
              rows={2}
              disabled={disabled}
            />
          </div>
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין שלבים." />}
    </EditorShell>
  );
}

/* ---------- bonuses (name + desc + value ₪) ---------- */
export function BonusesEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteBonus[];
  onChange: (v: QuoteBonus[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  const total = items.reduce((n, b) => n + (Number(b.value) || 0), 0);
  return (
    <EditorShell
      title="בונוסים במתנה"
      subtitle={`עוגן הערך. שווי כולל מוצג ללקוח: ₪${total.toLocaleString("he-IL")}`}
      disabled={disabled}
      onAdd={() => onChange([...items, { id: newId("bonus"), name: "", desc: "", value: 0 }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <Input
                value={it.name}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="שם הבונוס"
                className="h-9"
                disabled={disabled}
              />
              <div className="relative">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={Number.isFinite(it.value) ? it.value : 0}
                  onChange={(e) =>
                    onChange(
                      items.map((x, j) =>
                        j === i ? { ...x, value: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x
                      )
                    )
                  }
                  placeholder="שווי"
                  className="h-9 pe-8"
                  disabled={disabled}
                />
                <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
                  ₪
                </span>
              </div>
            </div>
            <Textarea
              value={it.desc ?? ""}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
              placeholder="תיאור קצר"
              rows={2}
              disabled={disabled}
            />
          </div>
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין בונוסים." />}
    </EditorShell>
  );
}

/* ---------- upsells (picked from the admin-curated catalog) ---------- */
/** Toggle-a-catalog-row picker, mirroring ScopeSection.tsx: each upsell
 *  catalog row toggles a `QuoteUpsell` in/out of `value`. Selecting a row
 *  copies a SNAPSHOT of its label/description/price into the quote content ,
 *  a later edit to the catalog (or the row's deletion) never changes a quote
 *  that already picked it. "מומלץ" is inherited read-only from the catalog;
 *  there's no per-quote recommended toggle. The only per-quote edit is price,
 *  which patches content.upsells[i] and never the shared catalog row.
 *
 *  `catalog` is the FULL upsell list (every type, from useUpsellCatalog); this
 *  component scopes it to the quote's own `type` , a row matches when its
 *  `type` equals the quote's type, or is `null` (universal, shown for every
 *  type). See hooks/useQuotesV2.ts `catalogFor` for the same rule used
 *  elsewhere in the builder. */
export function UpsellsPicker({
  catalog,
  type,
  value,
  onChange,
  disabled,
}: {
  catalog: QuoteCatalogRow[];
  type: QuoteType;
  value: QuoteUpsell[];
  onChange: (v: QuoteUpsell[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  const scoped = catalog.filter((row) => row.type === null || row.type === type);

  function toggle(row: QuoteCatalogRow) {
    if (disabled) return;
    const exists = items.some((it) => it.id === row.id);
    if (exists) {
      onChange(items.filter((it) => it.id !== row.id));
      return;
    }
    onChange([
      ...items,
      {
        id: row.id,
        title: row.label,
        desc: row.description ?? undefined,
        price: Number(row.base_price ?? 0),
        recommended: row.recommended,
      },
    ]);
  }

  function setPrice(itemId: string, price: number) {
    onChange(items.map((it) => (it.id === itemId ? { ...it, price } : it)));
  }

  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">תוספות (Upsells)</p>
        <p className="text-xs text-muted-foreground">הצעות תוספת מהקטלוג שהלקוח יכול לבחור בהצעת המחיר.</p>
      </div>
      {catalog.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          עדיין אין תוספות בקטלוג.{" "}
          <Link to="/admin/tools/quote/defaults" className="text-primary underline underline-offset-2">
            הוסף תוספות בדף ברירות מחדל
          </Link>
          .
        </p>
      ) : scoped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          אין תוספות לסוג הזה.{" "}
          <Link to="/admin/tools/quote/defaults" className="text-primary underline underline-offset-2">
            אפשר להוסיף בדף ברירות מחדל
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {scoped.map((row) => {
            const item = items.find((it) => it.id === row.id);
            const selected = !!item;
            return (
              <div
                key={row.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors",
                  selected ? "border-primary/50 bg-primary/5" : "border-border bg-field"
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(row)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-start justify-between gap-2 text-start text-sm",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
                      {row.label}
                    </span>
                    {row.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Star className="size-2.5 fill-current" />
                        מומלץ
                      </span>
                    )}
                  </span>
                  {!selected && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {shekel(Number(row.base_price ?? 0))}
                    </span>
                  )}
                </button>
                {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                {selected && item && (
                  <div className="relative w-32 self-end">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={Number.isFinite(item.price) ? item.price : 0}
                      onChange={(e) => setPrice(row.id, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                      disabled={disabled}
                      className="h-8 pe-8 text-end text-sm"
                      aria-label={`מחיר עבור ${row.label}`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
                      ₪
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------- maintenance (per-type tiers picked from the admin catalog) ----------
 * Toggle-a-catalog-row picker, mirroring UpsellsPicker: each `quote_maintenance_tiers`
 * row (scoped to the quote's product type via useMaintenanceTiers) toggles a
 * MaintenanceTierSnapshot in/out of content.maintenance.tiers. Selecting a tier
 * copies a SNAPSHOT of its name/price/description/recommended , a later catalog
 * edit (or the row's deletion) never changes a quote that already picked it.
 * "מומלץ" is inherited read-only from the catalog row; the only per-quote edit is
 * price, which patches the snapshot and never the shared catalog row. */
export function MaintenanceEditor({
  tiers,
  value,
  onChange,
  disabled,
}: {
  tiers: QuoteMaintenanceTierRow[];
  value: { offer: boolean; tiers: MaintenanceTierSnapshot[] };
  onChange: (v: { offer: boolean; tiers: MaintenanceTierSnapshot[] }) => void;
  disabled?: boolean;
}) {
  const selected = value?.tiers ?? [];

  function toggle(row: QuoteMaintenanceTierRow) {
    if (disabled) return;
    const exists = selected.some((it) => it.key === row.key);
    onChange({
      ...value,
      tiers: exists
        ? selected.filter((it) => it.key !== row.key)
        : [
            ...selected,
            {
              key: row.key,
              name: row.name,
              price: Number(row.price ?? 0),
              description: row.description ?? undefined,
              recommended: row.recommended,
            },
          ],
    });
  }

  function setPrice(key: string, price: number) {
    onChange({ ...value, tiers: selected.map((it) => (it.key === key ? { ...it, price } : it)) });
  }

  return (
    <Card className="space-y-3 p-5">
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          checked={!!value?.offer}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, offer: e.target.checked })}
          className="size-4 accent-primary"
        />
        הצע תחזוקה בהצעת המחיר
      </label>
      {value?.offer &&
        (tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground ps-6">
            עדיין אין רמות תחזוקה בקטלוג של הסוג הזה.{" "}
            <Link to="/admin/tools/quote/defaults" className="text-primary underline underline-offset-2">
              הוסף רמות תחזוקה בדף ברירות מחדל
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-2 ps-6 sm:grid-cols-2">
            {tiers.map((row) => {
              const item = selected.find((it) => it.key === row.key);
              const isSelected = !!item;
              return (
                <div
                  key={row.key}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-field"
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(row)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-start justify-between gap-2 text-start text-sm",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>
                        {row.name}
                      </span>
                      {row.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Star className="size-2.5 fill-current" />
                          מומלץ
                        </span>
                      )}
                    </span>
                    {!isSelected && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {shekel(Number(row.price ?? 0))} לחודש
                      </span>
                    )}
                  </button>
                  {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                  {isSelected && item && (
                    <div className="relative w-32 self-end">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={Number.isFinite(item.price) ? item.price : 0}
                        onChange={(e) => setPrice(row.key, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                        disabled={disabled}
                        className="h-8 pe-8 text-end text-sm"
                        aria-label={`מחיר חודשי עבור ${row.name}`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
                        ₪
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </Card>
  );
}

/* ---------- next steps (single line) ---------- */
export function StepsEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteStep[];
  onChange: (v: QuoteStep[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  return (
    <EditorShell
      title="מה קורה אחרי שחותמים"
      subtitle="הצעדים הבאים. מוריד חשש ומסביר את התהליך."
      disabled={disabled}
      onAdd={() => onChange([...items, { id: newId("step"), text: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/30 p-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {i + 1}
          </span>
          <Input
            value={it.text}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            placeholder="צעד"
            className="h-9 flex-1"
            disabled={disabled}
          />
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין צעדים." />}
    </EditorShell>
  );
}

/* ---------- FAQ (q + a) ---------- */
export function FaqEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteFaq[];
  onChange: (v: QuoteFaq[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  return (
    <EditorShell
      title="שאלות נפוצות"
      subtitle="מנטרל התנגדויות של הרגע האחרון לפני החתימה."
      disabled={disabled}
      onAdd={() => onChange([...items, { id: newId("faq"), q: "", a: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <Input
              value={it.q}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
              placeholder="שאלה"
              className="h-9"
              disabled={disabled}
            />
            <Textarea
              value={it.a}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
              placeholder="תשובה"
              rows={2}
              disabled={disabled}
            />
          </div>
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין שאלות." />}
    </EditorShell>
  );
}

/* ---------- legal clauses (string[]) ---------- */
export function LegalEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  return (
    <EditorShell title="סעיפים משפטיים" subtitle="מוצגים בתחתית ההצעה." disabled={disabled} onAdd={() => onChange([...items, ""])}>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-2">
          <span className="mt-2 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
          <Textarea
            value={it}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="סעיף"
            rows={2}
            className="flex-1"
            disabled={disabled}
          />
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין סעיפים." />}
    </EditorShell>
  );
}

/* ---------- studio testimonial (single, optional) ---------- */
export function TestimonialEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteTestimonial | null | undefined;
  onChange: (v: QuoteTestimonial | null) => void;
  disabled?: boolean;
}) {
  const on = !!(value && value.quote);
  const t = value ?? { quote: "", name: "", role: "" };
  return (
    <Card className="space-y-3 p-5">
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.checked ? { quote: t.quote || "", name: t.name || "", role: t.role || "" } : null)
          }
          className="size-4 accent-primary"
        />
        המלצת לקוח בהצעה
      </label>
      {on && (
        <div className="space-y-2 ps-6">
          <Textarea
            value={t.quote}
            onChange={(e) => onChange({ ...t, quote: e.target.value })}
            placeholder="ציטוט ההמלצה (קצר, 2-3 שורות)"
            rows={3}
            disabled={disabled}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={t.name}
              onChange={(e) => onChange({ ...t, name: e.target.value })}
              placeholder="שם הממליץ"
              className="h-9"
              disabled={disabled}
            />
            <Input
              value={t.role ?? ""}
              onChange={(e) => onChange({ ...t, role: e.target.value })}
              placeholder="תפקיד / עסק (למשל: Moving Art)"
              className="h-9"
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- discount (amount / percent, optional) ---------- */
export function DiscountEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteDiscount | null | undefined;
  onChange: (v: QuoteDiscount | null) => void;
  disabled?: boolean;
}) {
  const on = !!value;
  const d = value ?? { mode: "amount" as const, value: 0, label: "" };
  return (
    <Card className="space-y-3 p-5">
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? { mode: "amount", value: 0, label: "" } : null)}
          className="size-4 accent-primary"
        />
        הנחה מותאמת אישית (מוצגת ללקוח)
      </label>
      {on && (
        <div className="grid gap-3 ps-6 sm:grid-cols-[9rem_1fr]">
          <div className="space-y-1">
            <Label className="text-xs">סוג</Label>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["amount", "percent"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...d, mode: m })}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 text-xs transition-colors",
                    d.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "amount" ? "₪" : "%"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{d.mode === "percent" ? "אחוז הנחה" : "סכום הנחה (₪)"}</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={Number.isFinite(d.value) ? d.value : 0}
              onChange={(e) => onChange({ ...d, value: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              className="h-9"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">כותרת ההנחה (אופציונלי, למשל ״הנחת השקה״)</Label>
            <Input
              value={d.label ?? ""}
              onChange={(e) => onChange({ ...d, label: e.target.value })}
              placeholder="הנחה"
              className="h-9"
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- payment split + validity (shared small form) ---------- */
export function PaymentValidityEditor({
  payment,
  validityDays,
  onChangePayment,
  onChangeValidity,
  disabled,
}: {
  payment: QuotePayment;
  validityDays: number;
  onChangePayment: (p: QuotePayment) => void;
  onChangeValidity: (days: number) => void;
  disabled?: boolean;
}) {
  return (
    <Card className="grid gap-3 p-5 sm:grid-cols-2">
      <p className="text-sm font-semibold text-foreground sm:col-span-2">תשלום ותוקף</p>
      <div className="space-y-1">
        <Label className="text-xs">מקדמה לאישור (%)</Label>
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            value={Number.isFinite(payment.deposit_pct) ? payment.deposit_pct : 50}
            onChange={(e) =>
              onChangePayment({
                ...payment,
                deposit_pct: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
              })
            }
            className="h-9 pe-8"
            disabled={disabled}
          />
          <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
            %
          </span>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">תוקף ההצעה (ימים)</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={Number.isFinite(validityDays) ? validityDays : 7}
          onChange={(e) => onChangeValidity(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          className="h-9"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">מלל תנאי תשלום (מוצג ללקוח)</Label>
        <Input
          value={payment.terms ?? ""}
          onChange={(e) => onChangePayment({ ...payment, terms: e.target.value })}
          className="h-9"
          disabled={disabled}
        />
      </div>
    </Card>
  );
}

/* ============================================================================
 * Grouped per-quote content editors , everything in QuoteContentV2 that isn't
 * already covered by the shell (type/subtype/scope, Task 4) or the price
 * panel (final_price/options, Task 5), split into 3 workflow-tab groups for
 * QuoteBuilderShell (Task 7: tabbed layout). Each editor + primitive above
 * is unchanged; this just regroups which wrapper renders which.
 * ========================================================================== */

/** Tab "הצעה": narrative + differentiators + phases + testimonial. */
export function ProposalEditors({
  content,
  onChange,
  onChangeFn,
  disabled,
  clientName,
  clientBusiness,
}: {
  content: QuoteContentV2;
  onChange: (next: QuoteContentV2) => void;
  /** Functional-update path , applies an updater against the LATEST content
   *  at commit time (React's functional setState form), not the `content`
   *  captured when the async AI call started. Required for any apply that
   *  happens after an `await`: writing back `{ ...content, ... }` from a
   *  stale closure would silently revert whatever the admin edited while the
   *  multi-second Gemini call was pending. */
  onChangeFn: (updater: (prev: QuoteContentV2) => QuoteContentV2) => void;
  disabled: boolean;
  /** Client identity , top-level DB columns in QuoteBuilderShell (not part of
   *  `content`) , passed through only to give the AI narrative assist a hint
   *  about who the quote is for. Optional; the prompt still works without them. */
  clientName?: string;
  clientBusiness?: string;
}) {
  const [aiPending, setAiPending] = useState(false);

  async function handleAiCopy() {
    setAiPending(true);
    try {
      // Captured before the await: a type switch mid-flight re-seeds the whole
      // content, and a narrative written for the old type must not land in it.
      const typeAtCall = content.type;
      const scope_labels = content.scope.filter((it) => !it.optional && !it.free).map((it) => it.label);
      const result = await quoteAiCopy({
        type: content.type,
        subtype: content.subtype,
        client_name: clientName,
        client_business: clientBusiness,
        scope_labels,
        notes: content.notes,
      });
      // Functional apply , only overwrites `narrative` against whatever the
      // content is NOW, so any edit made elsewhere while this awaited is kept.
      onChangeFn((prev) => (prev.type === typeAtCall ? { ...prev, narrative: result.narrative } : prev));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "ה-AI לא הצליח לנסח את הטקסט, נסה שוב.");
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="quote-narrative" className="text-sm font-semibold text-foreground">
            תיאור / ניסוח פתיחה
          </Label>
          <button
            type="button"
            disabled={disabled || aiPending}
            onClick={() => void handleAiCopy()}
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary/15 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/25",
              (disabled || aiPending) && "cursor-not-allowed opacity-60 hover:bg-primary/15"
            )}
          >
            {aiPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {aiPending ? "מנסח…" : "נסח עם AI"}
          </button>
        </div>
        <Textarea
          id="quote-narrative"
          value={content.narrative}
          onChange={(e) => onChange({ ...content, narrative: e.target.value })}
          placeholder="פסקת פתיחה אישית ללקוח (בקול של אורי)"
          rows={4}
          disabled={disabled}
        />
      </Card>

      <DiffsEditor
        value={content.differentiators}
        onChange={(v) => onChange({ ...content, differentiators: v })}
        disabled={disabled}
      />

      <PhasesEditor value={content.phases} onChange={(v) => onChange({ ...content, phases: v })} disabled={disabled} />

      <TestimonialEditor
        value={content.testimonial}
        onChange={(v) => onChange({ ...content, testimonial: v })}
        disabled={disabled}
      />
    </div>
  );
}

/** Tab "תוספות": upsells picker + bonuses + maintenance + discount. */
export function AddonsEditors({
  content,
  onChange,
  onChangeFn,
  disabled,
  upsellCatalog,
  clientBusiness,
}: {
  content: QuoteContentV2;
  onChange: (next: QuoteContentV2) => void;
  /** Functional-update path , see the identical prop on ProposalEditors. */
  onChangeFn: (updater: (prev: QuoteContentV2) => QuoteContentV2) => void;
  disabled: boolean;
  upsellCatalog: QuoteCatalogRow[];
  /** Client business name, top-level DB column in QuoteBuilderShell (not part
   *  of `content`) , passed through only to give the AI upsell assist a hint
   *  about who the quote is for. Optional; the prompt still works without it. */
  clientBusiness?: string;
}) {
  const { data: maintenanceTiers } = useMaintenanceTiers(content.type);
  const [aiPending, setAiPending] = useState(false);
  const notes = (content.notes ?? "").trim();

  // The picks quote_ai returns are already filtered against the `upsells`
  // catalog passed to it (quote-ai.ts); we still dedupe against what's
  // already in content.upsells before turning a pick into a snapshot, same
  // additive-only rule as the scope-fill assist , never re-adds or removes
  // an upsell the admin already toggled. Dedupe + apply both happen inside
  // the functional updater below, against the LATEST upsells at commit time
  // (not the `content` captured before the await) , otherwise an upsell the
  // admin added manually while this call was pending would look "new" to a
  // stale snapshot and get silently duplicated when the AI result lands.
  async function handleAiUpsells() {
    setAiPending(true);
    try {
      // Captured before the await: the guard inside the updater compares the
      // live prev.type against it, so a type switch mid-flight (which re-seeds
      // the whole content) drops the stale wrong-type suggestions instead of
      // adding them.
      const typeAtCall = content.type;
      const scoped = upsellCatalog.filter((row) => row.type === null || row.type === content.type);
      const scope_labels = content.scope.filter((it) => !it.optional && !it.free).map((it) => it.label);
      const result = await quoteAiUpsells({
        upsells: scoped.map((row) => ({ id: row.id, label: row.label, desc: row.description ?? undefined })),
        scope_labels,
        client_business: clientBusiness,
        notes: content.notes,
      });

      let addedCount = 0;
      let addedReasons: string[] = [];
      onChangeFn((prev) => {
        if (prev.type !== typeAtCall) return prev;
        const existingIds = new Set(prev.upsells.map((u) => u.id));
        const toAdd = result.picks.filter((p) => !existingIds.has(p.id));
        addedCount = toAdd.length;
        addedReasons = toAdd.map((p) => p.reason).filter((r): r is string => !!r);
        if (toAdd.length === 0) return prev;
        const byId = new Map(scoped.map((row) => [row.id, row]));
        const newSnapshots: QuoteUpsell[] = toAdd
          .map((p) => byId.get(p.id))
          .filter((row): row is QuoteCatalogRow => !!row)
          .map((row) => ({
            id: row.id,
            title: row.label,
            desc: row.description ?? undefined,
            price: Number(row.base_price ?? 0),
            recommended: row.recommended,
          }));
        return { ...prev, upsells: [...prev.upsells, ...newSnapshots] };
      });

      toast({
        title: addedCount > 0 ? `ה-AI הציע ${addedCount} תוספות` : "ה-AI לא מצא תוספות חדשות להציע",
        description: addedReasons.join(" · ") || undefined,
        variant: "success",
      });
    } catch (e) {
      toastError(e instanceof Error ? e.message : "ה-AI לא הצליח להציע תוספות, נסה שוב.");
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={disabled || aiPending || !notes}
          onClick={() => void handleAiUpsells()}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary/15 px-3.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25",
            (disabled || aiPending || !notes) && "cursor-not-allowed opacity-60 hover:bg-primary/15"
          )}
        >
          {aiPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {aiPending ? "מחפש תוספות…" : "הצע תוספות עם AI"}
        </button>
      </div>

      <UpsellsPicker
        catalog={upsellCatalog}
        type={content.type}
        value={content.upsells}
        onChange={(v) => onChange({ ...content, upsells: v })}
        disabled={disabled}
      />

      <BonusesEditor value={content.bonuses} onChange={(v) => onChange({ ...content, bonuses: v })} disabled={disabled} />

      <MaintenanceEditor
        tiers={maintenanceTiers ?? []}
        value={content.maintenance}
        onChange={(v) => onChange({ ...content, maintenance: v })}
        disabled={disabled}
      />

      <DiscountEditor value={content.discount} onChange={(v) => onChange({ ...content, discount: v })} disabled={disabled} />
    </div>
  );
}

/** Tab "תנאים": payment + validity + legal + faq + next_steps + vat + show_breakdown. */
export function TermsEditors({
  content,
  onChange,
  disabled,
}: {
  content: QuoteContentV2;
  onChange: (next: QuoteContentV2) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <PaymentValidityEditor
        payment={content.payment}
        validityDays={content.validity_days}
        onChangePayment={(p) => onChange({ ...content, payment: p })}
        onChangeValidity={(days) => onChange({ ...content, validity_days: days })}
        disabled={disabled}
      />

      <LegalEditor value={content.legal} onChange={(v) => onChange({ ...content, legal: v })} disabled={disabled} />

      <FaqEditor value={content.faq} onChange={(v) => onChange({ ...content, faq: v })} disabled={disabled} />

      <StepsEditor value={content.next_steps} onChange={(v) => onChange({ ...content, next_steps: v })} disabled={disabled} />

      <Card className="grid gap-3 p-5 sm:grid-cols-2">
        <p className="text-sm font-semibold text-foreground sm:col-span-2">מע״מ והצגת פירוט</p>
        <div className="space-y-1">
          <Label htmlFor="quote-vat" className="text-xs">
            מע״מ (%)
          </Label>
          <div className="relative">
            <Input
              id="quote-vat"
              type="number"
              inputMode="numeric"
              value={Number.isFinite(content.vat_pct) ? content.vat_pct : 18}
              onChange={(e) =>
                onChange({ ...content, vat_pct: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })
              }
              className="h-9 pe-8"
              disabled={disabled}
            />
            <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={content.show_breakdown}
              disabled={disabled}
              onChange={(e) => onChange({ ...content, show_breakdown: e.target.checked })}
              className="size-4 accent-primary"
            />
            הצג פירוט מחיר ללקוח
          </label>
        </div>
      </Card>
    </div>
  );
}
