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
  type QuoteDefaultsContent,
} from "@/hooks/useQuotesV2";
import { newId } from "@/lib/quote-v2";
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

/** One editable draft row for the upsell catalog CRUD below. `id` is undefined
 *  until the row is first saved (insert); `key` is the stable React key so a
 *  not-yet-saved row keeps its identity across re-renders. */
type UpsellDraft = {
  id?: string;
  key: string;
  label: string;
  description: string;
  base_price: number;
  recommended: boolean;
};

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
      }))
    );
  }, [catalog]);

  function updateDraft(key: string, patch: Partial<UpsellDraft>) {
    setDrafts((prev) => (prev ? prev.map((d) => (d.key === key ? { ...d, ...patch } : d)) : prev));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...(prev ?? []),
      { key: newId("upsell-draft"), label: "", description: "", base_price: 0, recommended: false },
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
        subtitle="הקטלוג שממנו אורי בוחר תוספות בכל הצעת מחיר. עריכה כאן לא משנה הצעות שכבר נשלחו."
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

export default function QuoteDefaultsV2() {
  const { data, isLoading } = useQuoteDefaultsV2();
  const save = useSaveQuoteDefaultsV2();

  const [content, setContent] = useState<(QuoteDefaultsContent & { id: string | null }) | null>(null);

  // Load once (background refetches after save shouldn't stomp in-progress edits).
  useEffect(() => {
    if (data && !content) setContent(data);
  }, [data, content]);

  async function handleSave() {
    if (!content) return;
    try {
      const id = await save.mutateAsync(content);
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
          subtitle="הבידולים, השלבים, הבונוסים, הצעדים הבאים, השאלות הנפוצות, הסעיפים המשפטיים, ההמלצה ותנאי התשלום שמופיעים אוטומטית בכל הצעה חדשה."
        />
      </div>

      {isLoading || !content ? (
        <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> טוען ברירות מחדל…
        </Card>
      ) : (
        <div className="space-y-5">
          <DiffsEditor value={content.differentiators} onChange={(v) => setContent({ ...content, differentiators: v })} />

          <PhasesEditor value={content.phases} onChange={(v) => setContent({ ...content, phases: v })} />

          <BonusesEditor value={content.bonuses} onChange={(v) => setContent({ ...content, bonuses: v })} />

          <UpsellCatalogSection />

          <StepsEditor value={content.next_steps} onChange={(v) => setContent({ ...content, next_steps: v })} />

          <FaqEditor value={content.faq} onChange={(v) => setContent({ ...content, faq: v })} />

          <LegalEditor value={content.legal} onChange={(v) => setContent({ ...content, legal: v })} />

          <TestimonialEditor value={content.testimonial} onChange={(v) => setContent({ ...content, testimonial: v })} />

          <PaymentValidityEditor
            payment={content.payment}
            validityDays={content.validity_days}
            onChangePayment={(p) => setContent({ ...content, payment: p })}
            onChangeValidity={(days) => setContent({ ...content, validity_days: days })}
          />

          <Card className="sticky bottom-4 z-10 flex items-center justify-end gap-3 border-primary/30 bg-card/95 p-5 shadow-lift backdrop-blur">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              שמירה
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
