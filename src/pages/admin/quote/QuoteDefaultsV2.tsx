// Quote system v2 , studio-wide defaults page (Task 6 of the v2 rebuild).
// Edits the `quote_defaults` row (QuoteDefaultsContent subset: differentiators/
// phases/bonuses/next_steps/faq/legal/payment/testimonial/validity_days) that
// seeds every new quote via createQuoteV2 / newQuoteContentFromDefaults. Reuses
// the same list-row editor primitives as the per-quote content editors
// (QuoteContentEditorsV2.tsx) to stay DRY.
// See .superpowers/sdd/task-6-brief.md and hooks/useQuotesV2.ts.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast, toastError } from "@/hooks/use-toast";
import {
  useQuoteDefaultsV2,
  useSaveQuoteDefaultsV2,
  useUpsellCatalog,
  useSaveUpsellCatalogItem,
  useDeleteUpsellCatalogItem,
  useQuoteCatalog,
  useSaveCatalogItem,
  useDeleteCatalogItem,
  catalogFor,
  type QuoteDefaultsContent,
} from "@/hooks/useQuotesV2";
import { newId } from "@/lib/quote-v2";
import { cn } from "@/lib/utils";
import type { QuoteType, ScopeItemKind } from "@/lib/quote-pricing";
import {
  BonusesEditor,
  DelBtn,
  DiffsEditor,
  EditorShell,
  EmptyRow,
  FaqEditor,
  LegalEditor,
  PaymentValidityEditor,
  PhasesEditor,
  StepsEditor,
  TestimonialEditor,
} from "./QuoteContentEditorsV2";

const TYPE_TABS: { value: QuoteType; label: string }[] = [
  { value: "website", label: "אתר" },
  { value: "system", label: "מערכת" },
  { value: "automation", label: "אוטומציה" },
];

/** One editable draft row for the upsell catalog CRUD below. `id` is undefined
 *  until the row is first saved (insert); `key` is the stable React key so a
 *  not-yet-saved row keeps its identity across re-renders. `type` scopes the
 *  upsell to one quote type in the builder's picker; `null` = כללי (universal,
 *  shown for every type). */
type UpsellDraft = {
  id?: string;
  key: string;
  label: string;
  description: string;
  base_price: number;
  recommended: boolean;
  type: QuoteType | null;
};

const UPSELL_TYPE_OPTIONS: { value: QuoteType | null; label: string }[] = [
  { value: "website", label: "אתר" },
  { value: "system", label: "מערכת" },
  { value: "automation", label: "אוטומציה" },
  { value: null, label: "כללי" },
];

/** CRUD over the `quote_catalog` upsell rows (kind='upsell'): the same
 *  catalog the builder's UpsellsPicker reads from (QuoteContentEditorsV2.tsx).
 *  Each row saves independently (its own "שמירה" button) since rows are
 *  separate DB records, unlike the single quote_defaults row above. */
function UpsellCatalogSection() {
  const { data: catalog, isLoading } = useUpsellCatalog();
  const saveItem = useSaveUpsellCatalogItem();
  const deleteItem = useDeleteUpsellCatalogItem();
  const [drafts, setDrafts] = useState<UpsellDraft[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UpsellDraft | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!catalog || loadedRef.current) return;
    loadedRef.current = true;
    setDrafts(
      catalog.map((row) => ({
        id: row.id,
        key: row.id,
        label: row.label,
        description: row.description ?? "",
        base_price: Number(row.base_price ?? 0),
        recommended: row.recommended,
        type: row.type,
      }))
    );
  }, [catalog]);

  function updateDraft(key: string, patch: Partial<UpsellDraft>) {
    setDrafts((prev) => (prev ? prev.map((d) => (d.key === key ? { ...d, ...patch } : d)) : prev));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...(prev ?? []),
      { key: newId("upsell-draft"), label: "", description: "", base_price: 0, recommended: false, type: "website" },
    ]);
  }

  async function handleSaveRow(draft: UpsellDraft) {
    if (!draft.label.trim()) {
      toastError("צריך כותרת לתוספת.");
      return;
    }
    try {
      const id = await saveItem.mutateAsync({
        id: draft.id,
        label: draft.label.trim(),
        description: draft.description.trim() || null,
        base_price: Math.max(0, Math.round(Number(draft.base_price) || 0)),
        recommended: draft.recommended,
        type: draft.type,
      });
      setDrafts((prev) => (prev ? prev.map((d) => (d.key === draft.key ? { ...d, id } : d)) : prev));
      toast({ title: "התוספת נשמרה", variant: "success" });
    } catch {
      toastError("השמירה נכשלה.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.id) {
        await deleteItem.mutateAsync(deleteTarget.id);
      }
      setDrafts((prev) => (prev ? prev.filter((d) => d.key !== deleteTarget.key) : prev));
      toast({ title: "התוספת נמחקה", variant: "success" });
    } catch {
      toastError("המחיקה נכשלה.");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <EditorShell
        title="ניהול תוספות (Upsells)"
        subtitle="הקטלוג שממנו אורי בוחר תוספות בכל הצעת מחיר. כל תוספת משויכת לסוג הצעה (או כללי, לכל הסוגים). עריכה כאן לא משנה הצעות שכבר נשלחו."
        onAdd={addDraft}
      >
        {isLoading || !drafts ? (
          <p className="text-sm text-muted-foreground">טוען תוספות…</p>
        ) : drafts.length === 0 ? (
          <EmptyRow text="אין תוספות בקטלוג." />
        ) : (
          drafts.map((d) => (
            <div key={d.key} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
              <div className="flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                  <Input
                    value={d.label}
                    onChange={(e) => updateDraft(d.key, { label: e.target.value })}
                    placeholder="כותרת התוספת"
                    className="h-9"
                  />
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={Number.isFinite(d.base_price) ? d.base_price : 0}
                      onChange={(e) =>
                        updateDraft(d.key, { base_price: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                      }
                      placeholder="מחיר"
                      className="h-9 pe-8"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
                      ₪
                    </span>
                  </div>
                </div>
                <Textarea
                  value={d.description}
                  onChange={(e) => updateDraft(d.key, { description: e.target.value })}
                  placeholder="תיאור קצר (מוצג ללקוח)"
                  rows={2}
                />
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    סוג הצעה (איפה התוספת תופיע)
                  </span>
                  <div className="flex flex-wrap overflow-hidden rounded-lg border border-border w-fit">
                    {UPSELL_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => updateDraft(d.key, { type: opt.value })}
                        className={cn(
                          "px-2.5 py-1.5 text-xs transition-colors",
                          d.type === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={d.recommended}
                      onChange={(e) => updateDraft(d.key, { recommended: e.target.checked })}
                      className="size-4 accent-primary"
                    />
                    מומלץ (הדגשה בבחירת התוספת)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saveItem.isPending}
                    onClick={() => handleSaveRow(d)}
                  >
                    {saveItem.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    שמירה
                  </Button>
                </div>
              </div>
              <DelBtn onClick={() => setDeleteTarget(d)} />
            </div>
          ))
        )}
      </EditorShell>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="מחיקת תוספת מהקטלוג"
        confirmLabel="מחק"
        description={
          <>
            הפעולה תמחק לצמיתות את התוספת
            {deleteTarget ? ` "${deleteTarget.label || "ללא שם"}"` : ""} מהקטלוג. הצעות מחיר קיימות שכבר בחרו בה
            שומרות עותק משלהן ולא ייפגעו.
          </>
        }
        onConfirm={handleDelete}
      />
    </>
  );
}

/** One editable draft row for a scope-item catalog group (subtypes/pages/
 *  features/modules/automations). Unlike upsells, these are always scoped to
 *  one fixed (kind, type) pair set by the group, so the row itself carries no
 *  type picker. */
type ScopeDraft = {
  id?: string;
  key: string;
  label: string;
  description: string;
  base_price: number;
  recommended: boolean;
};

/** CRUD over one (kind, type) slice of `quote_catalog` , e.g. all website
 *  "page" rows. Mirrors UpsellCatalogSection's draft/save/add/delete pattern
 *  but scoped to a single fixed kind+type (no per-row type picker needed).
 *  Reads from the same `["quote-catalog"]` cache as the upsell section and
 *  the builder's pickers, so edits here show up everywhere immediately. */
function CatalogGroupSection({
  title,
  subtitle,
  kind,
  type,
}: {
  title: string;
  subtitle: string;
  kind: ScopeItemKind;
  type: QuoteType;
}) {
  const { data: catalog, isLoading } = useQuoteCatalog();
  const saveItem = useSaveCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const [drafts, setDrafts] = useState<ScopeDraft[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScopeDraft | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!catalog || loadedRef.current) return;
    loadedRef.current = true;
    setDrafts(
      catalogFor(catalog, kind, type).map((row) => ({
        id: row.id,
        key: row.id,
        label: row.label,
        description: row.description ?? "",
        base_price: Number(row.base_price ?? 0),
        recommended: row.recommended,
      }))
    );
  }, [catalog, kind, type]);

  function updateDraft(key: string, patch: Partial<ScopeDraft>) {
    setDrafts((prev) => (prev ? prev.map((d) => (d.key === key ? { ...d, ...patch } : d)) : prev));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...(prev ?? []),
      { key: newId(`${kind}-draft`), label: "", description: "", base_price: 0, recommended: false },
    ]);
  }

  async function handleSaveRow(draft: ScopeDraft) {
    if (!draft.label.trim()) {
      toastError("צריך כותרת לפריט.");
      return;
    }
    try {
      const id = await saveItem.mutateAsync({
        id: draft.id,
        kind,
        type,
        label: draft.label.trim(),
        description: draft.description.trim() || null,
        base_price: Math.max(0, Math.round(Number(draft.base_price) || 0)),
        recommended: draft.recommended,
      });
      setDrafts((prev) => (prev ? prev.map((d) => (d.key === draft.key ? { ...d, id } : d)) : prev));
      toast({ title: "הפריט נשמר", variant: "success" });
    } catch {
      toastError("השמירה נכשלה.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.id) {
        await deleteItem.mutateAsync(deleteTarget.id);
      }
      setDrafts((prev) => (prev ? prev.filter((d) => d.key !== deleteTarget.key) : prev));
      toast({ title: "הפריט נמחק", variant: "success" });
    } catch {
      toastError("המחיקה נכשלה.");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <EditorShell title={title} subtitle={subtitle} onAdd={addDraft}>
        {isLoading || !drafts ? (
          <p className="text-sm text-muted-foreground">טוען…</p>
        ) : drafts.length === 0 ? (
          <EmptyRow text="אין פריטים בקטלוג הזה." />
        ) : (
          drafts.map((d) => (
            <div key={d.key} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3">
              <div className="flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                  <Input
                    value={d.label}
                    onChange={(e) => updateDraft(d.key, { label: e.target.value })}
                    placeholder="כותרת הפריט"
                    className="h-9"
                  />
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={Number.isFinite(d.base_price) ? d.base_price : 0}
                      onChange={(e) =>
                        updateDraft(d.key, { base_price: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                      }
                      placeholder="מחיר"
                      className="h-9 pe-8"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
                      ₪
                    </span>
                  </div>
                </div>
                <Textarea
                  value={d.description}
                  onChange={(e) => updateDraft(d.key, { description: e.target.value })}
                  placeholder="תיאור קצר (מוצג ללקוח, אופציונלי)"
                  rows={2}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={d.recommended}
                      onChange={(e) => updateDraft(d.key, { recommended: e.target.checked })}
                      className="size-4 accent-primary"
                    />
                    מומלץ (הדגשה בבחירת הפריט)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saveItem.isPending}
                    onClick={() => handleSaveRow(d)}
                  >
                    {saveItem.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    שמירה
                  </Button>
                </div>
              </div>
              <DelBtn onClick={() => setDeleteTarget(d)} />
            </div>
          ))
        )}
      </EditorShell>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="מחיקת פריט מהקטלוג"
        confirmLabel="מחק"
        description={
          <>
            הפעולה תמחק לצמיתות את הפריט
            {deleteTarget ? ` "${deleteTarget.label || "ללא שם"}"` : ""} מהקטלוג. הצעות מחיר קיימות שכבר כוללות אותו
            שומרות עותק משלהן ולא ייפגעו.
          </>
        }
        onConfirm={handleDelete}
      />
    </>
  );
}

/** The full scope-item catalog editor for the current type tab: groups the
 *  relevant `quote_catalog` kinds for that type (website has three,
 *  system/automation each have one). Placed under the type tabs so switching
 *  tabs swaps which groups are shown, same as the rest of the page. */
function CatalogEditorSection({ type }: { type: QuoteType }) {
  if (type === "website") {
    return (
      <div className="space-y-5">
        <CatalogGroupSection
          title="ניהול תת-סוגי אתר"
          subtitle="תת-הסוגים שאורי בוחר מהם בבניית הצעת אתר (למשל: דף נחיתה, חנות, תיק עבודות)."
          kind="subtype"
          type="website"
        />
        <CatalogGroupSection
          title="ניהול עמודים"
          subtitle="העמודים שאפשר להוסיף לאתר בהצעת המחיר."
          kind="page"
          type="website"
        />
        <CatalogGroupSection
          title="ניהול פיצ'רים"
          subtitle="הפיצ'רים שאפשר להוסיף לאתר בהצעת המחיר."
          kind="feature"
          type="website"
        />
      </div>
    );
  }
  if (type === "system") {
    return (
      <CatalogGroupSection
        title="ניהול מודולים"
        subtitle="המודולים שאפשר להוסיף למערכת בהצעת המחיר."
        kind="module"
        type="system"
      />
    );
  }
  return (
    <CatalogGroupSection
      title="ניהול אוטומציות"
      subtitle="האוטומציות שאפשר להוסיף בהצעת המחיר."
      kind="automation"
      type="automation"
    />
  );
}

export default function QuoteDefaultsV2() {
  const [type, setType] = useState<QuoteType>("website");
  const { data, isLoading } = useQuoteDefaultsV2(type);
  const save = useSaveQuoteDefaultsV2();

  const [content, setContent] = useState<(QuoteDefaultsContent & { id: string | null; type: QuoteType }) | null>(
    null
  );

  // Load the selected type's row once it's fetched (background refetches after
  // save shouldn't stomp in-progress edits). Re-fires on type switch because
  // content.type no longer matches the newly selected type.
  useEffect(() => {
    if (data && data.type === type && content?.type !== type) setContent(data);
  }, [data, type, content]);

  // Gate rendering on the *selected* type's content, not just "some content is
  // loaded": switching tabs must not flash the previous type's data while the
  // new type's row is fetching. Holding the narrowed value (rather than a
  // plain boolean) lets TypeScript know `content` is non-null below.
  const ready = !isLoading && content && content.type === type ? content : null;

  async function handleSave() {
    if (!content || content.type !== type) return;
    try {
      const id = await save.mutateAsync({ ...content, type });
      setContent((prev) => (prev ? { ...prev, id } : prev));
      toast({ title: "ברירות המחדל נשמרו", variant: "success" });
    } catch {
      toastError("השמירה נכשלה.");
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/admin/tools/quote" aria-label="חזרה">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title="ברירות מחדל להצעות מחיר"
          subtitle="הבידולים, השלבים, הבונוסים, הצעדים הבאים, השאלות הנפוצות, הסעיפים המשפטיים, ההמלצה ותנאי התשלום שמופיעים אוטומטית בכל הצעה חדשה, לפי סוג ההצעה."
        />
      </div>

      <Card className="space-y-3 p-5">
        <p className="text-sm font-semibold text-foreground">סוג ההצעה</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="סוג ההצעה">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                type === t.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <CatalogEditorSection type={type} />

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">ברירות המחדל לתוכן ההצעה</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {!ready ? (
        <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> טוען ברירות מחדל…
        </Card>
      ) : (
        <div className="space-y-5">
          <DiffsEditor value={ready.differentiators} onChange={(v) => setContent({ ...ready, differentiators: v })} />

          <PhasesEditor value={ready.phases} onChange={(v) => setContent({ ...ready, phases: v })} />

          <BonusesEditor value={ready.bonuses} onChange={(v) => setContent({ ...ready, bonuses: v })} />

          <StepsEditor value={ready.next_steps} onChange={(v) => setContent({ ...ready, next_steps: v })} />

          <FaqEditor value={ready.faq} onChange={(v) => setContent({ ...ready, faq: v })} />

          <LegalEditor value={ready.legal} onChange={(v) => setContent({ ...ready, legal: v })} />

          <TestimonialEditor value={ready.testimonial} onChange={(v) => setContent({ ...ready, testimonial: v })} />

          <PaymentValidityEditor
            payment={ready.payment}
            validityDays={ready.validity_days}
            onChangePayment={(p) => setContent({ ...ready, payment: p })}
            onChangeValidity={(days) => setContent({ ...ready, validity_days: days })}
          />

          <Card className="sticky bottom-4 z-10 flex items-center justify-end gap-3 border-primary/30 bg-card/95 p-5 shadow-lift backdrop-blur">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              שמירה
            </Button>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          קטלוג התוספות (לא תלוי בטאב שנבחר למעלה; הסוג של כל תוספת נקבע בשורה שלה)
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <UpsellCatalogSection />
    </div>
  );
}
