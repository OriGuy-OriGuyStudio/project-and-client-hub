// Quote system v2 , admin builder SHELL (Task 4 of the v2 rebuild).
// Scope: type/subtype selection, itemized scope (separated by kind) and a
// live price anchor. Price options (fair/recommended/premium), the content
// editors (narrative, bonuses, upsells...) and the quotes list/send flow are
// later tasks , this page intentionally stops at "anchor".
// See .superpowers/sdd/task-4-brief.md and lib/quote-v2.ts / lib/quote-pricing.ts.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator, Loader2, Lock, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast, toastError } from "@/hooks/use-toast";
import {
  useQuoteCatalog,
  catalogFor,
  useQuoteV2,
  useCreateQuoteV2,
  useUpdateQuoteContentV2,
} from "@/hooks/useQuotesV2";
import { anchorValue, shekel, type QuoteType, type ScopeItem, type ScopeItemKind } from "@/lib/quote-pricing";
import { emptyQuoteV2, type QuoteContentV2 } from "@/lib/quote-v2";
import type { QuoteCatalogRow } from "@/types/database";
import { ScopeSection } from "./ScopeSection";

const TYPE_TABS: { value: QuoteType; label: string }[] = [
  { value: "website", label: "אתר" },
  { value: "system", label: "מערכת" },
  { value: "automation", label: "אוטומציה" },
];

/** Which scope sections (by catalog kind) show up for each quote type,
 *  separated per spec §8 , website splits pages vs features. */
const KIND_SECTIONS: Record<QuoteType, { kind: ScopeItemKind; title: string }[]> = {
  website: [
    { kind: "page", title: "עמודים" },
    { kind: "feature", title: "פיצ'רים" },
  ],
  system: [{ kind: "module", title: "מודולים" }],
  automation: [{ kind: "automation", title: "אוטומציות" }],
};

export default function QuoteBuilder() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const createQuote = useCreateQuoteV2();

  async function newQuote() {
    try {
      const id = await createQuote.mutateAsync("website");
      setActiveId(id);
    } catch {
      toastError("יצירת ההצעה נכשלה.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/admin/tools" aria-label="חזרה">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title="מחשבון תמחור והצעות"
          subtitle="בונה הצעת מחיר: סוג, היקף מוצרים ועוגן מחיר. אפשרויות מחיר, ניסוח ושליחה מגיעים בהמשך."
          actions={
            <Button onClick={newQuote} disabled={createQuote.isPending}>
              {createQuote.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              הצעה חדשה
            </Button>
          }
        />
      </div>

      {activeId ? (
        <QuoteBuilderShell id={activeId} />
      ) : (
        <EmptyState
          icon={Calculator}
          title="אין הצעה פתוחה"
          description="לחץ 'הצעה חדשה' כדי להתחיל: לבחור סוג, להרכיב היקף ולראות עוגן מחיר בזמן אמת."
        />
      )}
    </div>
  );
}

function QuoteBuilderShell({ id }: { id: string }) {
  const { data: quote, isLoading } = useQuoteV2(id);
  const { data: catalogRows } = useQuoteCatalog();
  const updateContent = useUpdateQuoteContentV2();

  const [content, setContent] = useState<QuoteContentV2 | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  // Load the row's content into local editable state once per quote id, so a
  // background refetch (e.g. after save) doesn't stomp in-progress edits.
  useEffect(() => {
    if (!quote || loadedIdRef.current === quote.id) return;
    loadedIdRef.current = quote.id;
    const raw = (quote.content ?? {}) as Partial<QuoteContentV2>;
    setContent({ ...emptyQuoteV2(quote.type), ...raw, type: quote.type });
  }, [quote]);

  const locked = quote?.status === "signed";

  const anchor = useMemo(() => {
    if (!content) return 0;
    return anchorValue({ type: content.type, items: content.scope });
  }, [content]);

  function setType(type: QuoteType) {
    if (locked || !content || type === content.type) return;
    // Different types draw from entirely separate catalogs, so switching
    // clears the scope + subtype rather than carrying over stale items.
    setContent({ ...content, type, subtype: undefined, scope: [] });
  }

  function selectSubtype(row: QuoteCatalogRow) {
    if (locked) return;
    setContent((prev) => {
      if (!prev) return prev;
      const already = prev.scope.some((it) => it.id === row.id && it.kind === "subtype");
      const withoutSubtype = prev.scope.filter((it) => it.kind !== "subtype");
      if (already) return { ...prev, subtype: undefined, scope: withoutSubtype };
      const item: ScopeItem = {
        id: row.id,
        kind: "subtype",
        label: row.label,
        value: Number(row.base_price ?? 0) * Number(row.default_mult ?? 1),
      };
      return { ...prev, subtype: row.label, scope: [...withoutSubtype, item] };
    });
  }

  function toggleScopeItem(row: QuoteCatalogRow, kind: ScopeItemKind) {
    if (locked) return;
    setContent((prev) => {
      if (!prev) return prev;
      const exists = prev.scope.some((it) => it.id === row.id);
      if (exists) return { ...prev, scope: prev.scope.filter((it) => it.id !== row.id) };
      const item: ScopeItem = {
        id: row.id,
        kind,
        label: row.label,
        value: Number(row.base_price ?? 0) * Number(row.default_mult ?? 1),
      };
      return { ...prev, scope: [...prev.scope, item] };
    });
  }

  function updateScopeValue(itemId: string, value: number) {
    if (locked) return;
    setContent((prev) =>
      prev ? { ...prev, scope: prev.scope.map((it) => (it.id === itemId ? { ...it, value } : it)) } : prev
    );
  }

  async function save() {
    if (!content || !quote) return;
    try {
      await updateContent.mutateAsync({
        id: quote.id,
        type: content.type,
        subtype: content.subtype ?? null,
        content,
        anchor,
      });
      toast({ title: "ההצעה נשמרה", variant: "success" });
    } catch {
      toastError("השמירה נכשלה.");
    }
  }

  if (isLoading || !content) {
    return (
      <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> טוען הצעה…
      </Card>
    );
  }

  const subtypeRows = catalogFor(catalogRows, "subtype", "website");
  const sections = KIND_SECTIONS[content.type];

  return (
    <div className="space-y-5 pb-24">
      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <Lock className="size-4 shrink-0" /> ההצעה נחתמה, אי אפשר לערוך אותה יותר.
        </div>
      )}

      <Card className="space-y-3 p-5">
        <p className="text-sm font-semibold text-foreground">סוג ההצעה</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="סוג ההצעה">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={content.type === t.value}
              disabled={locked}
              onClick={() => setType(t.value)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                content.type === t.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground",
                locked && "cursor-not-allowed opacity-60"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {content.type === "website" && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-semibold text-foreground">תת-סוג</p>
          {subtypeRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">אין עדיין תתי-סוג בקטלוג.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subtypeRows.map((row) => {
                const selected = content.scope.some((it) => it.id === row.id && it.kind === "subtype");
                return (
                  <button
                    key={row.id}
                    type="button"
                    disabled={locked}
                    aria-pressed={selected}
                    onClick={() => selectSubtype(row)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      locked && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {row.label}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {sections.map((s) => (
        <ScopeSection
          key={s.kind}
          title={s.title}
          rows={catalogFor(catalogRows, s.kind, content.type)}
          scope={content.scope}
          disabled={locked}
          onToggle={(row) => toggleScopeItem(row, s.kind)}
          onValueChange={updateScopeValue}
        />
      ))}

      <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-card/95 p-5 shadow-lift backdrop-blur">
        <div>
          <p className="text-xs text-muted-foreground">עוגן מחיר (סכום ההיקף שנבחר)</p>
          <p className="font-heading text-2xl font-bold text-primary">{shekel(anchor)}</p>
        </div>
        <Button onClick={save} disabled={locked || updateContent.isPending}>
          {updateContent.isPending && <Loader2 className="size-4 animate-spin" />}
          שמירה
        </Button>
      </Card>
    </div>
  );
}
