// Quote system v2 , admin builder SHELL (Task 4 of the v2 rebuild).
// Scope: type/subtype selection, itemized scope (separated by kind) and a
// live price anchor. Price options (fair/recommended/premium), the content
// editors (narrative, bonuses, upsells...) and the quotes list/send flow are
// later tasks , this page intentionally stops at "anchor".
// See .superpowers/sdd/task-4-brief.md and lib/quote-v2.ts / lib/quote-pricing.ts.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calculator,
  Copy,
  List,
  Loader2,
  Lock,
  Plus,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast, toastError } from "@/hooks/use-toast";
import {
  useQuoteCatalog,
  catalogFor,
  useQuotesV2,
  useQuoteV2,
  useCreateQuoteV2,
  useUpdateQuoteContentV2,
  useMarkQuoteSent,
  useDeleteQuoteV2,
  useQuoteMultipliers,
  useUpsellCatalog,
  DEFAULT_QUOTE_MULTIPLIERS,
} from "@/hooks/useQuotesV2";
import { anchorValue, shekel, type QuoteType, type ScopeItem, type ScopeItemKind } from "@/lib/quote-pricing";
import { emptyQuoteV2, optionalExtras, type QuoteContentV2 } from "@/lib/quote-v2";
import type { PriceQuote, QuoteCatalogRow } from "@/types/database";
import { ScopeSection } from "./ScopeSection";
import { PricePanel } from "./PricePanel";
import { ProposalEditors, AddonsEditors, TermsEditors } from "./QuoteContentEditorsV2";
import { AutomationGuide } from "./AutomationGuide";

const TYPE_TABS: { value: QuoteType; label: string }[] = [
  { value: "website", label: "אתר" },
  { value: "system", label: "מערכת" },
  { value: "automation", label: "אוטומציה" },
];

const TYPE_LABEL: Record<QuoteType, string> = Object.fromEntries(
  TYPE_TABS.map((t) => [t.value, t.label])
) as Record<QuoteType, string>;

type BuilderTab = "setup" | "price" | "proposal" | "addons" | "terms";

const BUILDER_TABS: { value: BuilderTab; label: string }[] = [
  { value: "setup", label: "הגדרה" },
  { value: "price", label: "מחיר" },
  { value: "proposal", label: "הצעה" },
  { value: "addons", label: "תוספות" },
  { value: "terms", label: "תנאים" },
];

const STATUS_BADGE: Record<PriceQuote["status"], { label: string; variant: BadgeProps["variant"] }> = {
  draft: { label: "טיוטה", variant: "secondary" },
  sent: { label: "נשלחה", variant: "cyan" },
  signed: { label: "נחתמה", variant: "success" },
  declined: { label: "נדחתה", variant: "destructive" },
};

/** Client-facing quote URL. The client page itself is a later plan; until
 *  then this link 404s, which we tell whoever copies it. */
function quoteShareUrl(token: string): string {
  return `${window.location.origin}/quote/${token}`;
}

async function copyQuoteLink(token: string) {
  const url = quoteShareUrl(token);
  try {
    await navigator.clipboard.writeText(url);
    toast({
      title: "הקישור הועתק",
      description: "עמוד הלקוח עוד לא בנוי, אז הקישור יחזיר 404 בינתיים.",
      variant: "success",
    });
  } catch {
    toastError(url, "העתקה נכשלה, הנה הקישור");
  }
}

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
          subtitle={
            activeId
              ? "בונה הצעת מחיר: סוג, היקף מוצרים, עוגן מחיר, ניסוח ושליחה."
              : "כל הצעות המחיר: פתיחה לעריכה, סימון כנשלחה, העתקת קישור ומחיקה."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {activeId && (
                <Button variant="ghost" onClick={() => setActiveId(null)}>
                  <List className="size-4" />
                  חזרה לרשימה
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link to="/admin/tools/quote/defaults">
                  <Settings2 className="size-4" />
                  ברירות מחדל
                </Link>
              </Button>
              <Button onClick={newQuote} disabled={createQuote.isPending}>
                {createQuote.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                הצעה חדשה
              </Button>
            </div>
          }
        />
      </div>

      {activeId ? <QuoteBuilderShell id={activeId} /> : <QuotesList onOpen={setActiveId} />}
    </div>
  );
}

/** The default (no quote open) view: every quote ever created, newest first,
 *  with the row-level actions Ori needs to manage a growing pile of them. */
function QuotesList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: quotes, isLoading } = useQuotesV2();
  const markSent = useMarkQuoteSent();
  const deleteQuote = useDeleteQuoteV2();
  const [deleteTarget, setDeleteTarget] = useState<PriceQuote | null>(null);

  async function handleMarkSent(id: string) {
    try {
      await markSent.mutateAsync(id);
      toast({ title: "ההצעה סומנה כנשלחה", variant: "success" });
    } catch {
      toastError("הסימון כנשלחה נכשל.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await deleteQuote.mutateAsync(id);
      toast({ title: "ההצעה נמחקה", variant: "success" });
    } catch {
      toastError("המחיקה נכשלה.");
    } finally {
      setDeleteTarget(null);
    }
  }

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> טוען הצעות…
      </Card>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <EmptyState
        icon={Calculator}
        title="אין הצעה פתוחה"
        description="לחץ 'הצעה חדשה' כדי להתחיל: לבחור סוג, להרכיב היקף ולראות עוגן מחיר בזמן אמת."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {quotes.map((q) => {
          const badge = STATUS_BADGE[q.status];
          const name = q.title || q.client_business || "הצעה ללא שם";
          return (
            <Card key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <button
                type="button"
                onClick={() => onOpen(q.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-start"
              >
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABEL[q.type]} · {shekel(q.final_price ?? 0)}
                  </p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onOpen(q.id)}>
                  פתח
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void copyQuoteLink(q.share_token)}>
                  <Copy className="size-3.5" />
                  העתק קישור
                </Button>
                {q.status === "draft" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={markSent.isPending}
                    onClick={() => handleMarkSent(q.id)}
                  >
                    <Send className="size-3.5" />
                    סמן כנשלח
                  </Button>
                )}
                {q.status !== "signed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(q)}
                  >
                    <Trash2 className="size-3.5" />
                    מחק
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="מחיקת הצעת מחיר"
        confirmLabel="מחק"
        description={
          <>
            הפעולה תמחק לצמיתות את ההצעה
            {deleteTarget ? ` "${deleteTarget.title || deleteTarget.client_business || "ללא שם"}"` : ""}. אי אפשר
            לשחזר.
          </>
        }
        onConfirm={handleDelete}
      />
    </>
  );
}

function QuoteBuilderShell({ id }: { id: string }) {
  const { data: quote, isLoading } = useQuoteV2(id);
  const { data: catalogRows } = useQuoteCatalog();
  const { data: upsellCatalog } = useUpsellCatalog();
  const { data: multipliers } = useQuoteMultipliers();
  const updateContent = useUpdateQuoteContentV2();
  const markSent = useMarkQuoteSent();

  const [content, setContent] = useState<QuoteContentV2 | null>(null);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientBusiness, setClientBusiness] = useState("");
  const [tab, setTab] = useState<BuilderTab>("setup");
  const loadedIdRef = useRef<string | null>(null);

  // Load the row's content into local editable state once per quote id, so a
  // background refetch (e.g. after save) doesn't stomp in-progress edits.
  useEffect(() => {
    if (!quote || loadedIdRef.current === quote.id) return;
    loadedIdRef.current = quote.id;
    const raw = (quote.content ?? {}) as Partial<QuoteContentV2>;
    setContent({ ...emptyQuoteV2(quote.type), ...raw, type: quote.type });
    // Identity fields are top-level DB columns, not part of `content`.
    setTitle(quote.title ?? "");
    setClientName(quote.client_name ?? "");
    setClientBusiness(quote.client_business ?? "");
  }, [quote]);

  const locked = quote?.status === "signed";

  const anchor = useMemo(() => {
    if (!content) return 0;
    return anchorValue({ type: content.type, items: content.scope });
  }, [content]);

  const extrasSubtotal = useMemo(() => {
    if (!content) return 0;
    return optionalExtras(content).subtotal;
  }, [content]);

  const mult = content ? multipliers?.[content.type] ?? DEFAULT_QUOTE_MULTIPLIERS[content.type] : null;

  function setType(type: QuoteType) {
    if (locked || !content || type === content.type) return;
    // Different types draw from entirely separate catalogs, so switching
    // clears the scope + subtype rather than carrying over stale items.
    setContent({ ...content, type, subtype: undefined, scope: [], final_price: 0 });
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

  function setScopeOptional(itemId: string, optional: boolean) {
    if (locked) return;
    setContent((prev) =>
      prev ? { ...prev, scope: prev.scope.map((it) => (it.id === itemId ? { ...it, optional } : it)) } : prev
    );
  }

  function setFinalPrice(price: number) {
    if (locked) return;
    setContent((prev) => (prev ? { ...prev, final_price: price } : prev));
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
        title: title.trim() || "הצעת מחיר",
        client_name: clientName.trim() || null,
        client_business: clientBusiness.trim() || null,
      });
      toast({ title: "ההצעה נשמרה", variant: "success" });
    } catch {
      toastError("השמירה נכשלה.");
    }
  }

  async function handleMarkSent() {
    if (!quote) return;
    try {
      await markSent.mutateAsync(quote.id);
      toast({ title: "ההצעה סומנה כנשלחה", variant: "success" });
    } catch {
      toastError("הסימון כנשלחה נכשל.");
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
      {quote && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <Badge variant={STATUS_BADGE[quote.status].variant}>{STATUS_BADGE[quote.status].label}</Badge>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => void copyQuoteLink(quote.share_token)}>
              <Copy className="size-3.5" />
              העתק קישור ללקוח
            </Button>
            {quote.status === "draft" && (
              <Button size="sm" variant="ghost" disabled={markSent.isPending} onClick={handleMarkSent}>
                <Send className="size-3.5" />
                סמן כנשלח
              </Button>
            )}
          </div>
        </Card>
      )}

      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <Lock className="size-4 shrink-0" /> ההצעה נחתמה, אי אפשר לערוך אותה יותר.
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="קטגוריית עריכה">
        {BUILDER_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              tab === t.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "setup" && (
        <div className="space-y-5">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-foreground">פרטי לקוח</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="quote-title">כותרת ההצעה</Label>
                <Input
                  id="quote-title"
                  value={title}
                  disabled={locked}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="הצעת מחיר"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-client-name">שם הלקוח</Label>
                <Input
                  id="quote-client-name"
                  value={clientName}
                  disabled={locked}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="לדוגמה: דנה כהן"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-client-business">שם העסק</Label>
                <Input
                  id="quote-client-business"
                  value={clientBusiness}
                  disabled={locked}
                  onChange={(e) => setClientBusiness(e.target.value)}
                  placeholder="לדוגמה: סטודיו דנה"
                />
              </div>
            </div>
          </Card>

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
              onToggleOptional={(itemId) => {
                const current = content.scope.find((it) => it.id === itemId);
                setScopeOptional(itemId, !current?.optional);
              }}
            />
          ))}

          {content.type === "automation" && <AutomationGuide />}
        </div>
      )}

      {tab === "price" && mult && (
        <PricePanel content={content} multipliers={mult} disabled={locked} onSetFinal={setFinalPrice} />
      )}

      {tab === "proposal" && <ProposalEditors content={content} onChange={setContent} disabled={locked} />}

      {tab === "addons" && (
        <AddonsEditors content={content} onChange={setContent} disabled={locked} upsellCatalog={upsellCatalog ?? []} />
      )}

      {tab === "terms" && <TermsEditors content={content} onChange={setContent} disabled={locked} />}

      <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-card/95 p-5 shadow-lift backdrop-blur">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <p className="text-xs text-muted-foreground">עוגן מחיר (סכום ההיקף שנבחר)</p>
            <p className="font-heading text-2xl font-bold text-primary">{shekel(anchor)}</p>
          </div>
          {extrasSubtotal > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">תוספות אופציונליות (ללקוח לבחירה)</p>
              <p className="font-heading text-2xl font-bold text-foreground">{shekel(extrasSubtotal)}</p>
            </div>
          )}
          {content.final_price > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">מחיר סופי</p>
              <p className="font-heading text-2xl font-bold text-foreground">{shekel(content.final_price)}</p>
            </div>
          )}
        </div>
        <Button onClick={save} disabled={locked || updateContent.isPending}>
          {updateContent.isPending && <Loader2 className="size-4 animate-spin" />}
          שמירה
        </Button>
      </Card>
    </div>
  );
}
