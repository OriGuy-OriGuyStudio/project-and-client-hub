import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { newId, type QuoteBonus, type QuoteDiff, type QuoteFaq, type QuotePhase, type QuoteStep } from "@/lib/quote";

/* Shared list editors for the quote's premium sections. Used by both the quote
 * builder (per-quote override) and the studio defaults page. Each editor takes a
 * typed array + onChange and stays fully controlled. */

function EditorShell({
  title,
  subtitle,
  onAdd,
  locked,
  children,
}: {
  title: string;
  subtitle?: string;
  onAdd: () => void;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {!locked && (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-4" /> הוסף
          </Button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function DelBtn({ onClick, locked }: { onClick: () => void; locked?: boolean }) {
  if (locked) return null;
  return (
    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive" onClick={onClick} aria-label="מחק">
      <Trash2 className="size-3.5" />
    </Button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/* ---------- differentiators (title + desc) ---------- */
export function DiffsEditor({ value, onChange, locked }: { value: QuoteDiff[]; onChange: (v: QuoteDiff[]) => void; locked?: boolean }) {
  const items = value ?? [];
  return (
    <EditorShell
      title="הבידול שלי (למה אני)"
      subtitle="הסיבות לבחור בך. מוצג ללקוח ככרטיסים."
      locked={locked}
      onAdd={() => onChange([...items, { id: newId(), title: "", desc: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <Input
              value={it.title}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              placeholder="כותרת"
              className="h-9"
              disabled={locked}
            />
            <Textarea
              value={it.desc ?? ""}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
              placeholder="תיאור קצר"
              rows={2}
              disabled={locked}
            />
          </div>
          <DelBtn locked={locked} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <Empty text="אין בידולים." />}
    </EditorShell>
  );
}

/* ---------- phases (name + desc + soft duration) ---------- */
export function PhasesEditor({ value, onChange, locked }: { value: QuotePhase[]; onChange: (v: QuotePhase[]) => void; locked?: boolean }) {
  const items = value ?? [];
  return (
    <EditorShell
      title="שלבים ולו״ז"
      subtitle="משך הזמן אופציונלי (טקסט חופשי כמו ״כשבוע״, או ריק אם עדיין לא ידוע)."
      locked={locked}
      onAdd={() => onChange([...items, { id: newId(), name: "", desc: "", duration: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {i + 1}
          </span>
          <div className="flex-1 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr,10rem]">
              <Input
                value={it.name}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="שם השלב"
                className="h-9"
                disabled={locked}
              />
              <Input
                value={it.duration ?? ""}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))}
                placeholder="משך (אופציונלי)"
                className="h-9"
                disabled={locked}
              />
            </div>
            <Textarea
              value={it.desc ?? ""}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
              placeholder="מה קורה בשלב הזה"
              rows={2}
              disabled={locked}
            />
          </div>
          <DelBtn locked={locked} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <Empty text="אין שלבים." />}
    </EditorShell>
  );
}

/* ---------- bonuses (name + desc + value ₪) ---------- */
export function BonusesEditor({ value, onChange, locked }: { value: QuoteBonus[]; onChange: (v: QuoteBonus[]) => void; locked?: boolean }) {
  const items = value ?? [];
  const total = items.reduce((n, b) => n + (Number(b.value) || 0), 0);
  return (
    <EditorShell
      title="בונוסים במתנה 🎁"
      subtitle={`עוגן הערך. שווי כולל מוצג ללקוח: ₪${total.toLocaleString("he-IL")}`}
      locked={locked}
      onAdd={() => onChange([...items, { id: newId(), name: "", desc: "", value: 0 }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr,8rem]">
              <Input
                value={it.name}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="שם הבונוס"
                className="h-9"
                disabled={locked}
              />
              <div className="relative">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={Number.isFinite(it.value) ? it.value : 0}
                  onChange={(e) =>
                    onChange(items.map((x, j) => (j === i ? { ...x, value: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)))
                  }
                  placeholder="שווי"
                  className="h-9 pe-8"
                  disabled={locked}
                />
                <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">₪</span>
              </div>
            </div>
            <Textarea
              value={it.desc ?? ""}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
              placeholder="תיאור קצר"
              rows={2}
              disabled={locked}
            />
          </div>
          <DelBtn locked={locked} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <Empty text="אין בונוסים." />}
    </EditorShell>
  );
}

/* ---------- next steps (single line) ---------- */
export function StepsEditor({ value, onChange, locked }: { value: QuoteStep[]; onChange: (v: QuoteStep[]) => void; locked?: boolean }) {
  const items = value ?? [];
  return (
    <EditorShell
      title="מה קורה אחרי שתחתום"
      subtitle="הצעדים הבאים. מוריד חשש ומסביר את התהליך."
      locked={locked}
      onAdd={() => onChange([...items, { id: newId(), text: "" }])}
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
            disabled={locked}
          />
          <DelBtn locked={locked} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <Empty text="אין צעדים." />}
    </EditorShell>
  );
}

/* ---------- FAQ (q + a) ---------- */
export function FaqEditor({ value, onChange, locked }: { value: QuoteFaq[]; onChange: (v: QuoteFaq[]) => void; locked?: boolean }) {
  const items = value ?? [];
  return (
    <EditorShell
      title="שאלות נפוצות"
      subtitle="מנטרל התנגדויות של הרגע האחרון לפני החתימה."
      locked={locked}
      onAdd={() => onChange([...items, { id: newId(), q: "", a: "" }])}
    >
      {items.map((it, i) => (
        <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
          <div className="flex-1 space-y-2">
            <Input
              value={it.q}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
              placeholder="שאלה"
              className="h-9"
              disabled={locked}
            />
            <Textarea
              value={it.a}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
              placeholder="תשובה"
              rows={2}
              disabled={locked}
            />
          </div>
          <DelBtn locked={locked} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <Empty text="אין שאלות." />}
    </EditorShell>
  );
}

/* ---------- legal clauses (string[]) ---------- */
export function LegalEditor({ value, onChange, locked }: { value: string[]; onChange: (v: string[]) => void; locked?: boolean }) {
  const items = value ?? [];
  return (
    <EditorShell
      title="סעיפים משפטיים"
      subtitle="מוצגים בתחתית ההצעה."
      locked={locked}
      onAdd={() => onChange([...items, ""])}
    >
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-2">
          <span className="mt-2 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
          <Textarea
            value={it}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="סעיף"
            rows={2}
            className="flex-1"
            disabled={locked}
          />
          <DelBtn locked={locked} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      {items.length === 0 && <Empty text="אין סעיפים." />}
    </EditorShell>
  );
}

/* ---------- payment split + validity (shared small form) ---------- */
export function PaymentValidityEditor({
  depositPct,
  terms,
  validityDays,
  onChange,
  locked,
}: {
  depositPct: number;
  terms: string;
  validityDays: number;
  onChange: (p: { depositPct?: number; terms?: string; validityDays?: number }) => void;
  locked?: boolean;
}) {
  return (
    <Card className="grid gap-3 p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">מקדמה לאישור (%)</Label>
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            value={Number.isFinite(depositPct) ? depositPct : 50}
            onChange={(e) => onChange({ depositPct: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
            className="h-9 pe-8"
            disabled={locked}
          />
          <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">%</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">תוקף ההצעה (ימים)</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={Number.isFinite(validityDays) ? validityDays : 7}
          onChange={(e) => onChange({ validityDays: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          className="h-9"
          disabled={locked}
        />
      </div>
      <div className={cn("space-y-1 sm:col-span-2")}>
        <Label className="text-xs">מלל תנאי תשלום (מוצג ללקוח)</Label>
        <Input value={terms} onChange={(e) => onChange({ terms: e.target.value })} className="h-9" disabled={locked} />
      </div>
    </Card>
  );
}
