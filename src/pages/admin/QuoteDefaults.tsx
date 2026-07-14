import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast, toastError } from "@/hooks/use-toast";
import { useQuoteDefaults, useSaveQuoteDefaults } from "@/hooks/useQuotes";
import { fallbackQuoteDefaults, type QuoteDefaults } from "@/lib/quote";
import {
  BonusesEditor,
  DiffsEditor,
  FaqEditor,
  LegalEditor,
  PaymentValidityEditor,
  PhasesEditor,
  StepsEditor,
} from "@/components/quote/QuoteContentEditors";

export default function QuoteDefaultsPage() {
  const { data, isLoading } = useQuoteDefaults();
  const save = useSaveQuoteDefaults();
  const [d, setD] = useState<QuoteDefaults>(fallbackQuoteDefaults());

  useEffect(() => {
    if (data?.defaults) setD(data.defaults);
  }, [data]);

  function patch(p: Partial<QuoteDefaults>) {
    setD((prev) => ({ ...prev, ...p }));
  }

  function onSave() {
    save.mutate(
      { id: data?.id ?? null, defaults: d },
      {
        onSuccess: () => toast({ title: "ברירות המחדל נשמרו ✓", variant: "success" }),
        onError: () => toastError("השמירה נכשלה."),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> טוען…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/admin/tools/quote" aria-label="חזרה">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title="ברירות מחדל להצעות מחיר"
          subtitle="התוכן הזה מזין כל הצעה חדשה. עורך פעם אחת, וכל הצעה נולדת מלאה ומלוטשת. עריכה כאן לא משנה הצעות שכבר נשלחו."
        />
      </div>

      <Card className="flex items-center justify-between gap-2 border-primary/30 bg-primary/5 p-4">
        <p className="text-sm text-foreground">שינויים נשמרים רק בלחיצה על ״שמירה״.</p>
        <Button onClick={onSave} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          שמירה
        </Button>
      </Card>

      <DiffsEditor value={d.differentiators} onChange={(v) => patch({ differentiators: v })} />
      <PhasesEditor value={d.phases} onChange={(v) => patch({ phases: v })} />
      <BonusesEditor value={d.bonuses} onChange={(v) => patch({ bonuses: v })} />
      <StepsEditor value={d.next_steps} onChange={(v) => patch({ next_steps: v })} />
      <FaqEditor value={d.faq} onChange={(v) => patch({ faq: v })} />
      <LegalEditor value={d.legal} onChange={(v) => patch({ legal: v })} />
      <PaymentValidityEditor
        depositPct={d.payment?.deposit_pct ?? 50}
        terms={d.payment?.terms ?? ""}
        validityDays={d.validity_days}
        onChange={(p) =>
          patch({
            payment: {
              deposit_pct: p.depositPct ?? d.payment?.deposit_pct ?? 50,
              terms: p.terms ?? d.payment?.terms ?? "",
            },
            validity_days: p.validityDays ?? d.validity_days,
          })
        }
      />

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={save.isPending} size="lg">
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          שמירת ברירות המחדל
        </Button>
      </div>
    </div>
  );
}
