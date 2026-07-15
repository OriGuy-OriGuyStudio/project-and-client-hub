// Quote system v2 , studio-wide defaults page (Task 6 of the v2 rebuild).
// Edits the `quote_defaults` row (QuoteDefaultsContent subset: differentiators/
// phases/bonuses/next_steps/faq/legal/payment/testimonial/validity_days) that
// seeds every new quote via createQuoteV2 / newQuoteContentFromDefaults. Reuses
// the same list-row editor primitives as the per-quote content editors
// (QuoteContentEditorsV2.tsx) to stay DRY.
// See .superpowers/sdd/task-6-brief.md and hooks/useQuotesV2.ts.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast, toastError } from "@/hooks/use-toast";
import { useQuoteDefaultsV2, useSaveQuoteDefaultsV2, type QuoteDefaultsContent } from "@/hooks/useQuotesV2";
import {
  BonusesEditor,
  DiffsEditor,
  FaqEditor,
  LegalEditor,
  PaymentValidityEditor,
  PhasesEditor,
  StepsEditor,
  TestimonialEditor,
} from "./QuoteContentEditorsV2";

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
