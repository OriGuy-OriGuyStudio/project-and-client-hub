// Quote system v2 , content editors (Task 6 of the v2 rebuild).
// Covers every QuoteContentV2 field not already handled by the shell (Task 4:
// type/subtype/scope) or the price panel (Task 5: final_price/options). The
// shared list-row primitives (EditorShell/DelBtn/Empty + the typed editors)
// are exported so QuoteDefaultsV2.tsx can reuse them for the studio-wide
// defaults subset, DRY per the brief.
// Adapted from the deleted v1 `components/quote/QuoteContentEditors.tsx`
// (see git show b1a5a79~1:...) to the v2 content shape.
// See .superpowers/sdd/task-6-brief.md and lib/quote-v2.ts.

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  newId,
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
import { TIER_META, TIER_ORDER, type ServiceTier } from "@/lib/service-plans";

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

/* ---------- upsells (title + desc + price + recommended) ---------- */
export function UpsellsEditor({
  value,
  onChange,
  disabled,
}: {
  value: QuoteUpsell[];
  onChange: (v: QuoteUpsell[]) => void;
  disabled?: boolean;
}) {
  const items = value ?? [];
  return (
    <EditorShell
      title="תוספות (Upsells)"
      subtitle="הצעות תוספת שהלקוח יכול לבחור בהצעת המחיר. סמן ״מומלץ״ להדגשה אחת."
      disabled={disabled}
      onAdd={() => onChange([...items, { id: newId("upsell"), title: "", desc: "", price: 0, recommended: false }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <Input
                value={it.title}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder="כותרת התוספת"
                className="h-9"
                disabled={disabled}
              />
              <div className="relative">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={Number.isFinite(it.price) ? it.price : 0}
                  onChange={(e) =>
                    onChange(
                      items.map((x, j) =>
                        j === i ? { ...x, price: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x
                      )
                    )
                  }
                  placeholder="מחיר"
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
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={!!it.recommended}
                disabled={disabled}
                onChange={(e) =>
                  onChange(items.map((x, j) => (j === i ? { ...x, recommended: e.target.checked } : x)))
                }
                className="size-4 accent-primary"
              />
              מומלץ (הדגשה בהצעה)
            </label>
          </div>
          <DelBtn disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="אין תוספות." />}
    </EditorShell>
  );
}

/* ---------- maintenance offer (toggle + tier multi-select) ---------- */
export function MaintenanceEditor({
  value,
  onChange,
  disabled,
}: {
  value: { offer: boolean; tiers: ServiceTier[] };
  onChange: (v: { offer: boolean; tiers: ServiceTier[] }) => void;
  disabled?: boolean;
}) {
  const tiers = value?.tiers ?? [];
  function toggleTier(t: ServiceTier) {
    if (disabled) return;
    onChange({
      ...value,
      tiers: tiers.includes(t) ? tiers.filter((x) => x !== t) : [...tiers, t],
    });
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
        הצע שירות ותחזוקה בהצעת המחיר
      </label>
      {value?.offer && (
        <div className="flex flex-wrap gap-2 ps-6">
          {TIER_ORDER.map((t) => {
            const selected = tiers.includes(t);
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggleTier(t)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                {TIER_META[t].name}
              </button>
            );
          })}
        </div>
      )}
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
 * Full per-quote content editor , everything in QuoteContentV2 that isn't
 * already covered by the shell (type/subtype/scope, Task 4) or the price
 * panel (final_price/options, Task 5).
 * ========================================================================== */

export function QuoteContentEditorsV2({
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
      <Card className="space-y-2 p-5">
        <Label htmlFor="quote-narrative" className="text-sm font-semibold text-foreground">
          תיאור / ניסוח פתיחה
        </Label>
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

      <BonusesEditor value={content.bonuses} onChange={(v) => onChange({ ...content, bonuses: v })} disabled={disabled} />

      <UpsellsEditor value={content.upsells} onChange={(v) => onChange({ ...content, upsells: v })} disabled={disabled} />

      <MaintenanceEditor
        value={content.maintenance}
        onChange={(v) => onChange({ ...content, maintenance: v })}
        disabled={disabled}
      />

      <StepsEditor value={content.next_steps} onChange={(v) => onChange({ ...content, next_steps: v })} disabled={disabled} />

      <FaqEditor value={content.faq} onChange={(v) => onChange({ ...content, faq: v })} disabled={disabled} />

      <LegalEditor value={content.legal} onChange={(v) => onChange({ ...content, legal: v })} disabled={disabled} />

      <TestimonialEditor
        value={content.testimonial}
        onChange={(v) => onChange({ ...content, testimonial: v })}
        disabled={disabled}
      />

      <DiscountEditor value={content.discount} onChange={(v) => onChange({ ...content, discount: v })} disabled={disabled} />

      <PaymentValidityEditor
        payment={content.payment}
        validityDays={content.validity_days}
        onChangePayment={(p) => onChange({ ...content, payment: p })}
        onChangeValidity={(days) => onChange({ ...content, validity_days: days })}
        disabled={disabled}
      />

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
