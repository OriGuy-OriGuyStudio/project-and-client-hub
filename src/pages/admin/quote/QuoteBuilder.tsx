// Quote system v2 , admin builder. Covers type/subtype selection, itemized
// scope (separated by kind), the live price anchor, price options
// (fair/recommended/premium), the content editors (narrative, bonuses,
// upsells...) and the quotes list/send flow. The client-facing page lives at
// src/pages/public/QuoteView.tsx (see docs/superpowers/plans/2026-07-16-quote-v2-plan3-client-page.md).
// See lib/quote-v2.ts / lib/quote-pricing.ts for the pricing engine.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calculator,
  ChevronDown,
  Copy,
  ExternalLink,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  fetchQuoteDefaultsContent,
  newQuoteContentFromDefaults,
  DEFAULT_QUOTE_MULTIPLIERS,
} from "@/hooks/useQuotesV2";
import { anchorValue, shekel, type QuoteType, type ScopeItem, type ScopeItemKind } from "@/lib/quote-pricing";
import {
  applyPlatformClause,
  discountAmount,
  emptyQuoteV2,
  optionalExtras,
  quoteTotals,
  type QuoteContentV2,
} from "@/lib/quote-v2";
import type { PriceQuote, QuoteCatalogRow } from "@/types/database";
import { ScopeSection, type ScopeItemMode } from "./ScopeSection";
import { PricePanel } from "./PricePanel";
import { ProposalEditors, AddonsEditors, TermsEditors } from "./QuoteContentEditorsV2";
import { AutomationGuide } from "./AutomationGuide";

const TYPE_TABS: { value: QuoteType; label: string }[] = [
  { value: "website", label: "אתר" },
  { value: "system", label: "מערכת" },
  { value: "automation", label: "אוטומציה" },
];

const PLATFORM_TABS: { value: "custom" | "wordpress"; label: string }[] = [
  { value: "custom", label: "קוד מותאם" },
  { value: "wordpress", label: "וורדפרס" },
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

/** Client-facing quote URL (the public page at src/pages/public/QuoteView.tsx). */
function quoteShareUrl(token: string): string {
  return `${window.location.origin}/quote/${token}`;
}

/** Opens the client-facing quote page in a new tab, e.g. so Ori can preview
 *  exactly what he's about to send. */
function openClientView(token: string) {
  window.open(quoteShareUrl(token), "_blank", "noopener");
}

async function copyQuoteLink(token: string) {
  const url = quoteShareUrl(token);
  try {
    await navigator.clipboard.writeText(url);
    toast({
      title: "הקישור הועתק",
      description: "אפשר לשלוח אותו ללקוח.",
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

/** Per-subtype starting point , when the admin picks a website subtype, these
 *  pages/features get auto-added to the scope so they don't build every quote
 *  from a blank slate. Keyed by the subtype catalog row's `label` (must match
 *  the seeded `quote_catalog` labels exactly). Purely additive and only a
 *  suggestion , the admin can deselect/adjust anything after. */
const SUBTYPE_DEFAULTS: Record<string, { pages: string[]; features: string[] }> = {
  "דף נחיתה": {
    pages: ["עמוד בית"],
    features: ["טפסים מתקדמים", "הגדרת מדידה (GA4 ופיקסלים)"],
  },
  "אתר תדמית": {
    pages: ["עמוד בית", "אודות", "שירותים", "צור קשר"],
    features: ["טפסים מתקדמים", "נגישות מלאה", "SEO טכני מוטמע"],
  },
  "חנות": {
    pages: ["עמוד בית", "עמוד מוצר", "קטגוריה", "סל ותשלום", "אודות", "צור קשר"],
    features: ["סליקה ותשלום", "חיפוש ופילטרים", "אזור אישי / התחברות"],
  },
  "קטלוג": {
    pages: ["עמוד בית", "קטגוריה", "עמוד מוצר", "צור קשר"],
    features: ["חיפוש ופילטרים"],
  },
  "אתר תוכן / מגזין": {
    pages: ["עמוד בית", "בלוג", "עמוד מאמר בודד", "אודות", "צור קשר"],
    features: ["מערכת ניהול תוכן", "חיפוש ופילטרים"],
  },
  "אתר אירוע": {
    pages: ["עמוד בית", "עמוד הזמנת תור", "צור קשר"],
    features: ["טפסים מתקדמים", "ספירה לאחור / טיימר"],
  },
  "מיקרו-סייט קמפיין": {
    pages: ["עמוד בית"],
    features: ["פופאפ ולכידת לידים", "הגדרת מדידה (GA4 ופיקסלים)"],
  },
  "אתר חד-עמודי": {
    pages: ["עמוד בית"],
    features: ["טפסים מתקדמים"],
  },
};

export default function QuoteBuilder() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const createQuote = useCreateQuoteV2();

  async function newQuote(type: QuoteType) {
    try {
      const id = await createQuote.mutateAsync(type);
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={createQuote.isPending}>
                    {createQuote.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    הצעה חדשה
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {TYPE_TABS.map((t) => (
                    <DropdownMenuItem key={t.value} onClick={() => void newQuote(t.value)}>
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
      </div>

      {activeId ? <QuoteBuilderShell key={activeId} id={activeId} /> : <QuotesList onOpen={setActiveId} />}
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
                <Button size="sm" variant="ghost" onClick={() => openClientView(q.share_token)}>
                  <ExternalLink className="size-3.5" />
                  פתח תצוגת לקוח
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
  const [switchingType, setSwitchingType] = useState(false);
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

  async function setType(type: QuoteType) {
    if (locked || !content || type === content.type || switchingType) return;
    // Different types draw from entirely separate catalogs and studio-wide
    // boilerplate (differentiators/phases/bonuses/faq/next steps/legal/
    // upsells/maintenance), so switching re-seeds the WHOLE content from the
    // new type's defaults rather than carrying over stale type-specific
    // content (e.g. website differentiators + WordPress legal leaking into
    // an automation quote). Client identity (title/name/business) lives in
    // top-level state outside `content`, so it's untouched by this.
    setSwitchingType(true);
    try {
      const defaults = await fetchQuoteDefaultsContent(type);
      setContent(newQuoteContentFromDefaults(type, defaults));
    } catch {
      toastError("החלפת סוג ההצעה נכשלה.");
    } finally {
      setSwitchingType(false);
    }
  }

  function setPlatform(platform: "custom" | "wordpress") {
    if (locked) return;
    setContent((prev) =>
      prev ? { ...prev, platform, legal: applyPlatformClause(prev.legal, platform) } : prev
    );
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
        desc: row.description ?? undefined,
      };
      let scope = [...withoutSubtype, item];

      // Selecting a subtype seeds its typical pages/features as a starting
      // point (additive only , never removes items the admin already picked,
      // and never overrides an item that's already in scope).
      const defaults = SUBTYPE_DEFAULTS[row.label];
      if (defaults) {
        const pageRows = catalogFor(catalogRows, "page", "website");
        const featureRows = catalogFor(catalogRows, "feature", "website");
        const toAdd: ScopeItem[] = [];
        for (const label of defaults.pages) {
          const catalogRow = pageRows.find((r) => r.label === label);
          if (catalogRow && !scope.some((it) => it.id === catalogRow.id)) {
            toAdd.push({
              id: catalogRow.id,
              kind: "page",
              label: catalogRow.label,
              value: Number(catalogRow.base_price ?? 0) * Number(catalogRow.default_mult ?? 1),
              desc: catalogRow.description ?? undefined,
            });
          }
        }
        for (const label of defaults.features) {
          const catalogRow = featureRows.find((r) => r.label === label);
          if (catalogRow && !scope.some((it) => it.id === catalogRow.id)) {
            toAdd.push({
              id: catalogRow.id,
              kind: "feature",
              label: catalogRow.label,
              value: Number(catalogRow.base_price ?? 0) * Number(catalogRow.default_mult ?? 1),
              desc: catalogRow.description ?? undefined,
            });
          }
        }
        scope = [...scope, ...toAdd];
      }

      return { ...prev, subtype: row.label, scope };
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
        desc: row.description ?? undefined,
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

  function setScopeMode(itemId: string, mode: ScopeItemMode) {
    if (locked) return;
    let patch: Partial<ScopeItem>;
    if (mode === "free") patch = { optional: false, free: true };
    else if (mode === "optional") patch = { optional: true, free: false };
    else patch = { optional: false, free: false };
    setContent((prev) =>
      prev ? { ...prev, scope: prev.scope.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : prev
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
            <Button size="sm" variant="ghost" onClick={() => openClientView(quote.share_token)}>
              <ExternalLink className="size-3.5" />
              פתח תצוגת לקוח
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
                  disabled={locked || switchingType}
                  onClick={() => void setType(t.value)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                    content.type === t.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    (locked || switchingType) && "cursor-not-allowed opacity-60"
                  )}
                >
                  {t.label}
                </button>
              ))}
              {switchingType && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />}
            </div>
          </Card>

          {content.type === "website" && (
            <Card className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">פלטפורמה</p>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="פלטפורמה">
                {PLATFORM_TABS.map((p) => {
                  const active = (content.platform ?? "wordpress") === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={locked}
                      onClick={() => setPlatform(p.value)}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-field text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        locked && "cursor-not-allowed opacity-60"
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

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
              onSetMode={setScopeMode}
            />
          ))}

          {content.type === "automation" && <AutomationGuide />}
        </div>
      )}

      {tab === "price" && mult && (
        <>
          <PricePanel
            content={content}
            multipliers={mult}
            disabled={locked}
            onSetFinal={setFinalPrice}
            clientBusiness={clientBusiness}
          />
          <PriceSummaryCard content={content} mult={mult} />
        </>
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
              <p className="text-xs text-muted-foreground">
                מחיר סופי{discountAmount(content.final_price, content.discount) > 0 ? " (אחרי הנחה)" : ""}
              </p>
              <p className="font-heading text-2xl font-bold text-foreground">
                {shekel(content.final_price - discountAmount(content.final_price, content.discount))}
              </p>
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

/** Price-tab summary card , shows the final price minus discount plus VAT as
 *  an actual total, so entering a discount or changing VAT% has a visible
 *  effect (before this, the builder only ever rendered the 3 price options +
 *  the manual final price, never the computed bottom line). Uses an empty
 *  client selection (no upsells/maintenance chosen) , the base figure a
 *  client pays before picking any optional extras, which is the right
 *  admin-facing number here. */
function PriceSummaryCard({
  content,
  mult,
}: {
  content: QuoteContentV2;
  mult: { fair: number; recommended: number; premium: number; floor: number };
}) {
  const totals = quoteTotals(
    content,
    { upsell_ids: [], optional_ids: [], maintenance_tier: null },
    mult,
    mult.floor,
    () => 0,
  );
  const extras = optionalExtras(content);
  const lowestTierPrice =
    content.maintenance?.offer && content.maintenance.tiers.length > 0
      ? Math.min(...content.maintenance.tiers.map((t) => t.price))
      : null;

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm font-semibold text-foreground">סיכום מחיר</p>

      {content.final_price <= 0 ? (
        <p className="text-sm text-muted-foreground">בחר מחיר סופי כדי לראות את הסיכום</p>
      ) : (
        <>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">מחיר סופי</span>
              <span className="font-medium text-foreground">{shekel(content.final_price)}</span>
            </div>

            {totals.discount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  הנחה{content.discount?.label ? ` (${content.discount.label})` : ""}
                </span>
                <span className="font-medium text-warning">- {shekel(totals.discount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">מע״מ ({content.vat_pct}%)</span>
              <span className="font-medium text-foreground">+ {shekel(totals.vat)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">סה״כ לתשלום</span>
            <span className="font-heading text-2xl font-bold text-primary">{shekel(totals.total)}</span>
          </div>

          {lowestTierPrice !== null && (
            <p className="text-xs text-muted-foreground">
              + תחזוקה חודשית: מ-{shekel(lowestTierPrice)}/חודש
            </p>
          )}

          {extras.subtotal > 0 && (
            <p className="text-xs text-muted-foreground">
              בנוסף: תוספות אופציונליות לבחירת הלקוח ({shekel(extras.subtotal)})
            </p>
          )}
        </>
      )}
    </Card>
  );
}
