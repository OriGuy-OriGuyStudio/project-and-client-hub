import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calculator,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useQuotes, useQuote, useQuoteCatalog, useQuoteDefaults } from "@/hooks/useQuotes";
import { usePlanConfig } from "@/lib/plan-config";
import { TIER_ORDER, TIER_META, type ServiceTier } from "@/lib/service-plans";
import {
  bonusesTotal,
  computeQuote,
  emptyQuoteContent,
  linePrice,
  newQuoteContent,
  paymentSplit,
  shekel,
  withVat,
  QUOTE_MULTS,
  SITE_TYPE_LABEL,
  type QuoteContent,
  type QuoteDefaults,
  type QuoteLine,
  type QuoteSiteType,
  type QuoteUpsell,
} from "@/lib/quote";
import {
  BonusesEditor,
  DiffsEditor,
  FaqEditor,
  LegalEditor,
  PaymentValidityEditor,
  PhasesEditor,
  StepsEditor,
} from "@/components/quote/QuoteContentEditors";
import type { PriceQuote, QuoteCatalogRow } from "@/types/database";

const uid = () => crypto.randomUUID();
const SITE_TYPES: QuoteSiteType[] = ["portfolio", "store", "app", "custom", "landing"];
const STATUS_HE: Record<string, string> = { draft: "טיוטה", sent: "נשלחה", signed: "נחתמה", declined: "נדחתה" };

export default function QuoteTool() {
  const qc = useQueryClient();
  const { data: quotes } = useQuotes();
  const { data: defaultsData } = useQuoteDefaults();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createQuote() {
    setCreating(true);
    const { data, error } = await supabase
      .from("price_quotes")
      .insert({
        title: "הצעת מחיר",
        site_type: "portfolio",
        content: newQuoteContent(defaultsData?.defaults) as unknown as Record<string, unknown>,
        status: "draft",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) return toastError("יצירת ההצעה נכשלה.");
    qc.invalidateQueries({ queryKey: ["price-quotes"] });
    setActiveId(data.id);
  }

  if (activeId) return <QuoteBuilder id={activeId} onBack={() => setActiveId(null)} />;

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
          subtitle="בונה הצעת מחיר עם עמודים, פיצ'רים ואפסיילים, ומייצר דף הצעה יפה ללקוח עם חתימה."
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="secondary">
          <Link to="/admin/tools/quote/defaults">
            <Settings2 className="size-4" /> ברירות מחדל
          </Link>
        </Button>
        <Button onClick={createQuote} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          הצעה חדשה
        </Button>
      </div>

      {(quotes ?? []).length === 0 ? (
        <EmptyState icon={Calculator} title="אין עדיין הצעות מחיר" description="לחץ 'הצעה חדשה' כדי לבנות הצעה." />
      ) : (
        <div className="space-y-2">
          {(quotes ?? []).map((q) => (
            <QuoteRow key={q.id} q={q} onOpen={() => setActiveId(q.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteRow({ q, onOpen }: { q: PriceQuote; onOpen: () => void }) {
  const c = q.content as unknown as QuoteContent;
  const totals = computeQuote(c);
  return (
    <Card
      className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4 transition-colors hover:border-primary/40"
      onClick={onOpen}
    >
      <div className="min-w-0">
        <p className="truncate font-heading text-base font-semibold text-foreground">
          {q.title}
          {q.client_name ? ` · ${q.client_name}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {SITE_TYPE_LABEL[q.site_type]} · {shekel(withVat(totals.oneTimeBase, c.vat_pct ?? 18))} כולל מע״מ
        </p>
      </div>
      <Badge variant={q.status === "signed" ? "success" : q.status === "sent" ? "secondary" : "warning"}>
        {STATUS_HE[q.status] ?? q.status}
      </Badge>
    </Card>
  );
}

/* ============================== builder ============================== */

function QuoteBuilder({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: quote, isLoading } = useQuote(id);
  const { data: catalog } = useQuoteCatalog();
  const { data: defaultsData } = useQuoteDefaults();
  const { config } = usePlanConfig();

  if (isLoading || !quote) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> טוען…
      </div>
    );
  }
  return (
    <BuilderForm
      key={quote.id}
      quote={quote}
      catalog={catalog ?? []}
      defaults={defaultsData?.defaults ?? null}
      tierPrice={(t) => config[t].price}
      onBack={onBack}
      invalidate={() => {
        qc.invalidateQueries({ queryKey: ["price-quote", id] });
        qc.invalidateQueries({ queryKey: ["price-quotes"] });
      }}
    />
  );
}

function BuilderForm({
  quote,
  catalog,
  defaults,
  tierPrice,
  onBack,
  invalidate,
}: {
  quote: PriceQuote;
  catalog: QuoteCatalogRow[];
  defaults: QuoteDefaults | null;
  tierPrice: (t: ServiceTier) => number;
  onBack: () => void;
  invalidate: () => void;
}) {
  const c0 = quote.content as unknown as QuoteContent;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(quote.title ?? "הצעת מחיר");
  const [clientName, setClientName] = useState(quote.client_name ?? "");
  const [siteType, setSiteType] = useState<QuoteSiteType>(quote.site_type);
  const [c, setC] = useState<QuoteContent>({ ...emptyQuoteContent(), ...c0 });
  const locked = quote.status === "signed";

  function patch(p: Partial<QuoteContent>) {
    setC((prev) => ({ ...prev, ...p }));
  }

  const totals = computeQuote(c);
  const shareUrl = `${window.location.origin}/quote/${quote.share_token}`;

  function addLine(field: "pages" | "features") {
    patch({ [field]: [...c[field], { id: uid(), name: "", mult: 1 }] } as Partial<QuoteContent>);
  }
  function patchLine(field: "pages" | "features", i: number, p: Partial<QuoteLine>) {
    patch({ [field]: c[field].map((l, j) => (j === i ? { ...l, ...p } : l)) } as Partial<QuoteContent>);
  }
  function removeLine(field: "pages" | "features", i: number) {
    patch({ [field]: c[field].filter((_, j) => j !== i) } as Partial<QuoteContent>);
  }
  function loadPreset(field: "pages" | "features") {
    const kind = field === "pages" ? "page" : "feature";
    const have = new Set(c[field].map((l) => l.name.trim()));
    const add = catalog
      .filter((r) => r.kind === kind && (kind === "feature" || r.site_type === siteType) && !have.has(r.label))
      .map((r) => ({ id: uid(), name: r.label, mult: Number(r.default_mult) || 1 }));
    if (!add.length) return toast({ title: "אין פריטים חדשים להוסיף" });
    patch({ [field]: [...c[field], ...add] } as Partial<QuoteContent>);
  }

  function addUpsell() {
    patch({ upsells: [...c.upsells, { id: uid(), title: "", desc: "", price: 0 }] });
  }
  function patchUpsell(i: number, p: Partial<QuoteUpsell>) {
    patch({ upsells: c.upsells.map((u, j) => (j === i ? { ...u, ...p } : u)) });
  }
  function removeUpsell(i: number) {
    patch({ upsells: c.upsells.filter((_, j) => j !== i) });
  }
  function loadUpsellPresets() {
    const have = new Set(c.upsells.map((u) => u.title.trim()));
    const add = catalog
      .filter((r) => r.kind === "upsell" && !have.has(r.label))
      .map((r) => ({ id: uid(), title: r.label, desc: r.description ?? "", price: Number(r.base_price) || 0 }));
    if (!add.length) return toast({ title: "אין אפסיילים חדשים להוסיף" });
    patch({ upsells: [...c.upsells, ...add] });
  }

  function toggleTier(t: ServiceTier) {
    const has = c.maintenance.tiers.includes(t);
    patch({
      maintenance: {
        ...c.maintenance,
        tiers: has ? c.maintenance.tiers.filter((x) => x !== t) : [...c.maintenance.tiers, t],
      },
    });
  }

  function loadFromDefaults() {
    if (!defaults) return toastError("ברירות המחדל עדיין נטענות.");
    if (!window.confirm("לטעון מחדש נרטיב/שלבים/בונוסים/שאלות/סעיפים מברירות המחדל? זה ידרוס את מה שערכת פה במקטעים האלה.")) return;
    patch({
      differentiators: defaults.differentiators,
      phases: defaults.phases,
      bonuses: defaults.bonuses,
      next_steps: defaults.next_steps,
      faq: defaults.faq,
      legal: defaults.legal,
      payment: defaults.payment,
      validity_days: defaults.validity_days,
    });
    toast({ title: "נטען מברירות המחדל ✓", variant: "success" });
  }

  async function save(nextStatus?: PriceQuote["status"]) {
    setSaving(true);
    const { error } = await supabase
      .from("price_quotes")
      .update({
        title: title.trim() || "הצעת מחיר",
        client_name: clientName.trim() || null,
        site_type: siteType,
        content: c as unknown as Record<string, unknown>,
        status: nextStatus ?? quote.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id);
    setSaving(false);
    if (error) return toastError("השמירה נכשלה.");
    toast({ title: nextStatus === "sent" ? "סומן כנשלח ✓" : "נשמר", variant: "success" });
    invalidate();
  }

  async function remove() {
    if (!window.confirm("למחוק את ההצעה?")) return;
    const { error } = await supabase.from("price_quotes").delete().eq("id", quote.id);
    if (error) return toastError("המחיקה נכשלה.");
    invalidate();
    onBack();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack} aria-label="חזרה">
          <ArrowRight className="size-4" />
        </Button>
        <PageHeader title={title || "הצעת מחיר"} subtitle={`${SITE_TYPE_LABEL[siteType]} · ${STATUS_HE[quote.status]}`} />
      </div>

      {locked && (
        <Card className="border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
          ההצעה נחתמה ע״י {quote.signed_name || "הלקוח"} ולכן נעולה לעריכה. הבחירות של הלקוח מסומנות למטה.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,20rem]">
        {/* left: builder */}
        <div className="space-y-4">
          {/* site type tabs */}
          <div className="flex flex-wrap gap-2">
            {SITE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={locked}
                onClick={() => setSiteType(t)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition-colors",
                  t === siteType
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {SITE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {/* client + base prices */}
          <Card className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="שם הלקוח">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={locked} />
            </Field>
            <Field label="כותרת ההצעה">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
            </Field>
            <Field label="מחיר בסיס לפרויקט (₪)">
              <NumberInput value={c.base_project} onChange={(v) => patch({ base_project: v })} disabled={locked} />
            </Field>
            <Field label="מחיר בסיס לעמוד (₪)">
              <NumberInput value={c.base_page} onChange={(v) => patch({ base_page: v })} disabled={locked} />
            </Field>
            <Field label="מחיר בסיס לפיצ'ר (₪)">
              <NumberInput value={c.base_feature} onChange={(v) => patch({ base_feature: v })} disabled={locked} />
            </Field>
            <Field label="מע״מ (%)">
              <NumberInput value={c.vat_pct} onChange={(v) => patch({ vat_pct: v })} disabled={locked} />
            </Field>
            <div className="sm:col-span-2">
              <Label className="text-xs">מרווח ביטחון</Label>
              <div className="mt-1 flex gap-2">
                {[10, 20, 30].map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={locked}
                    onClick={() => patch({ margin_pct: m })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      c.margin_pct === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {m}%
                  </button>
                ))}
              </div>
            </div>
            <Field label="טקסט פתיחה ללקוח (מוצג בדף ההצעה)" full>
              <Textarea value={c.intro ?? ""} onChange={(e) => patch({ intro: e.target.value })} rows={2} disabled={locked} />
            </Field>
          </Card>

          <LineSection
            title="עמודים"
            base={c.base_page}
            lines={c.pages}
            locked={locked}
            onAdd={() => addLine("pages")}
            onPreset={() => loadPreset("pages")}
            onPatch={(i, p) => patchLine("pages", i, p)}
            onRemove={(i) => removeLine("pages", i)}
          />
          <LineSection
            title="פיצ'רים"
            base={c.base_feature}
            lines={c.features}
            locked={locked}
            onAdd={() => addLine("features")}
            onPreset={() => loadPreset("features")}
            onPatch={(i, p) => patchLine("features", i, p)}
            onRemove={(i) => removeLine("features", i)}
          />

          {/* upsells */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-foreground">אפסיילים (מוצגים ללקוח לבחירה)</h3>
              {!locked && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={loadUpsellPresets}>
                    <Sparkles className="size-4" /> טען מוכנים
                  </Button>
                  <Button variant="secondary" size="sm" onClick={addUpsell}>
                    <Plus className="size-4" /> הוסף
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {c.upsells.map((u, i) => (
                <div key={u.id} className="grid gap-2 rounded-xl border border-border bg-background/30 p-3 sm:grid-cols-[1fr,1fr,7rem,auto]">
                  <Input value={u.title} onChange={(e) => patchUpsell(i, { title: e.target.value })} placeholder="שם" className="h-9" disabled={locked} />
                  <Input value={u.desc ?? ""} onChange={(e) => patchUpsell(i, { desc: e.target.value })} placeholder="תיאור קצר" className="h-9" disabled={locked} />
                  <NumberInput value={u.price} onChange={(v) => patchUpsell(i, { price: v })} disabled={locked} suffix="₪" />
                  {!locked && (
                    <Button variant="ghost" size="icon" className="size-9 text-destructive" onClick={() => removeUpsell(i)} aria-label="מחק">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {c.upsells.length === 0 && <p className="text-sm text-muted-foreground">אין אפסיילים. הוסף כדי להגדיל את העסקה.</p>}
            </div>
          </Card>

          {/* maintenance */}
          <Card className="space-y-2 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={c.maintenance.offer}
                disabled={locked}
                onChange={(e) => patch({ maintenance: { ...c.maintenance, offer: e.target.checked } })}
                className="size-4 accent-primary"
              />
              הצע חבילת תחזוקה בדף הלקוח (אופציונלי ללקוח)
            </label>
            {c.maintenance.offer && (
              <div className="flex flex-wrap gap-2 ps-6">
                {TIER_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleTier(t)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs",
                      c.maintenance.tiers.includes(t)
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {TIER_META[t].name} · {shekel(tierPrice(t))}/חודש
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* premium content sections (seeded from defaults, editable per quote) */}
          <Card className="flex flex-wrap items-center justify-between gap-2 border-dashed p-4">
            <div>
              <h3 className="font-heading text-base font-semibold text-foreground">תוכן ההצעה</h3>
              <p className="text-xs text-muted-foreground">נרטיב, שלבים, בונוסים ומקטעי הסגירה. מגיע מברירות המחדל, אפשר לערוך פר לקוח.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/tools/quote/defaults">
                  <Settings2 className="size-4" /> ערוך ברירות מחדל
                </Link>
              </Button>
              {!locked && (
                <Button variant="secondary" size="sm" onClick={loadFromDefaults}>
                  <RefreshCw className="size-4" /> טען מברירות מחדל
                </Button>
              )}
            </div>
          </Card>

          <PaymentValidityEditor
            depositPct={c.payment?.deposit_pct ?? 50}
            terms={c.payment?.terms ?? ""}
            validityDays={c.validity_days ?? 7}
            locked={locked}
            onChange={(p) =>
              patch({
                payment: {
                  deposit_pct: p.depositPct ?? c.payment?.deposit_pct ?? 50,
                  terms: p.terms ?? c.payment?.terms ?? "",
                },
                validity_days: p.validityDays ?? c.validity_days ?? 7,
              })
            }
          />
          <PhasesEditor value={c.phases ?? []} onChange={(v) => patch({ phases: v })} locked={locked} />
          <BonusesEditor value={c.bonuses ?? []} onChange={(v) => patch({ bonuses: v })} locked={locked} />
          <DiffsEditor value={c.differentiators ?? []} onChange={(v) => patch({ differentiators: v })} locked={locked} />
          <StepsEditor value={c.next_steps ?? []} onChange={(v) => patch({ next_steps: v })} locked={locked} />
          <FaqEditor value={c.faq ?? []} onChange={(v) => patch({ faq: v })} locked={locked} />
          <LegalEditor value={c.legal ?? []} onChange={(v) => patch({ legal: v })} locked={locked} />
        </div>

        {/* right: summary + actions */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="space-y-2 p-5">
            <h3 className="font-heading text-base font-semibold text-foreground">סיכום</h3>
            <Row label="מחיר בסיס" value={shekel(c.base_project)} />
            <Row label="עמודים" value={shekel(totals.pagesTotal)} />
            <Row label="פיצ'רים" value={shekel(totals.featuresTotal)} />
            <Row label={`מרווח ביטחון (${c.margin_pct}%)`} value={shekel(totals.margin)} accent />
            <div className="border-t border-border pt-2">
              <Row label="סה״כ לא כולל מע״מ" value={shekel(totals.oneTimeBase)} />
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">כולל מע״מ</span>
                <span className="font-heading text-2xl font-black text-primary">
                  {shekel(withVat(totals.oneTimeBase, c.vat_pct))}
                </span>
              </div>
            </div>
            {bonusesTotal(c) > 0 && (
              <Row label="שווי בונוסים במתנה 🎁" value={shekel(bonusesTotal(c))} accent />
            )}
            {(() => {
              const split = paymentSplit(withVat(totals.oneTimeBase, c.vat_pct), c);
              return (
                <div className="border-t border-border pt-2 text-xs">
                  <Row label={`מקדמה (${split.depositPct}%)`} value={shekel(split.deposit)} />
                  <Row label="יתרה לפני השקה" value={shekel(split.rest)} />
                </div>
              );
            })()}
          </Card>

          <div className="flex flex-col gap-2">
            {!locked && (
              <Button onClick={() => save()} disabled={saving}>
                {saving ? "שומר…" : "שמירה"}
              </Button>
            )}
            <Button asChild variant="secondary">
              <a href={shareUrl} target="_blank" rel="noopener">
                <ExternalLink className="size-4" /> תצוגה מקדימה (דף הלקוח)
              </a>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).then(
                  () => toast({ title: "הלינק הועתק", variant: "success" }),
                  () => toastError("ההעתקה נכשלה.")
                );
              }}
            >
              <Copy className="size-4" /> העתק לינק ללקוח
            </Button>
            {!locked && quote.status === "draft" && (
              <Button variant="secondary" onClick={() => save("sent")} disabled={saving}>
                <Send className="size-4" /> סמן כנשלחה
              </Button>
            )}
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="size-4" /> מחיקת ההצעה
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LineSection({
  title,
  base,
  lines,
  locked,
  onAdd,
  onPreset,
  onPatch,
  onRemove,
}: {
  title: string;
  base: number;
  lines: QuoteLine[];
  locked: boolean;
  onAdd: () => void;
  onPreset: () => void;
  onPatch: (i: number, p: Partial<QuoteLine>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onPreset}>
              <Sparkles className="size-4" /> טען מוכנים
            </Button>
            <Button variant="secondary" size="sm" onClick={onAdd}>
              <Plus className="size-4" /> הוסף
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={l.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/30 p-2">
            <Input
              value={l.name}
              onChange={(e) => onPatch(i, { name: e.target.value })}
              placeholder="שם"
              className="h-9 flex-1"
              disabled={locked}
            />
            <div className="flex overflow-hidden rounded-lg border border-border">
              {QUOTE_MULTS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={locked}
                  onClick={() => onPatch(i, { mult: m })}
                  className={cn(
                    "px-2.5 py-1.5 text-xs transition-colors",
                    l.mult === m
                      ? m === 1
                        ? "bg-primary text-primary-foreground"
                        : "bg-amber-400 text-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}×
                </button>
              ))}
            </div>
            <span className="w-16 shrink-0 text-end text-sm tabular-nums text-foreground">{shekel(linePrice(base, l.mult))}</span>
            {!locked && (
              <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => onRemove(i)} aria-label="מחק">
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {lines.length === 0 && <p className="text-sm text-muted-foreground">אין {title}. הוסף או טען מוכנים.</p>}
      </div>
    </Card>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", full && "sm:col-span-2")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  disabled,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className={cn("h-9", suffix && "pe-8")}
        disabled={disabled}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", accent ? "text-primary" : "text-foreground")}>{value}</span>
    </div>
  );
}
