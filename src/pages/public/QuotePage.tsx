import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";
import { usePublicQuote } from "@/hooks/useQuotes";
import { usePlanConfig } from "@/lib/plan-config";
import { TIER_ORDER, type ServiceTier } from "@/lib/service-plans";
import {
  computeQuote,
  shekel,
  withVat,
  SITE_TYPE_LABEL,
  type QuoteContent,
  type QuoteSiteType,
} from "@/lib/quote";
import { cn } from "@/lib/utils";

export default function QuotePage() {
  const { token } = useParams<{ token: string }>();
  const { data: quote, isLoading } = usePublicQuote(token);
  const { config } = usePlanConfig();

  const [upsellIds, setUpsellIds] = useState<string[]>([]);
  const [maintTier, setMaintTier] = useState<ServiceTier | null>(null);
  const [name, setName] = useState("");
  const [sig, setSig] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  const content = quote?.content as unknown as QuoteContent | undefined;
  const monthlyFor = (t: ServiceTier) => config[t].price;
  const totals = useMemo(
    () => (content ? computeQuote(content, { upsell_ids: upsellIds, maintenance_tier: maintTier }, monthlyFor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, upsellIds, maintTier, config]
  );

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> טוען הצעה…
        </div>
      </Shell>
    );
  }
  if (!quote || !content) {
    return (
      <Shell>
        <div className="py-24 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">ההצעה לא נמצאה</h1>
          <p className="mt-2 text-muted-foreground">ייתכן שהקישור שגוי או שההצעה הוסרה.</p>
        </div>
      </Shell>
    );
  }

  const alreadySigned = quote.status === "signed" || justSigned;

  async function submit() {
    if (!name.trim()) return toastError("נא למלא שם מלא.");
    if (!sig) return toastError("נא לחתום בתיבת החתימה.");
    setSubmitting(true);
    const { data, error } = await supabase.rpc("sign_quote", {
      p_token: token!,
      p_name: name.trim(),
      p_signature_image: sig,
      p_upsell_ids: upsellIds as unknown as never,
      p_maintenance_tier: maintTier,
    });
    setSubmitting(false);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) return toastError(res?.error || "האישור נכשל, נסו שוב.");
    setJustSigned(true);
  }

  if (alreadySigned) {
    // Recompute from what was chosen (fresh submit uses live state; earlier signing uses stored selected).
    const chosen = justSigned
      ? { upsell_ids: upsellIds, maintenance_tier: maintTier }
      : ((quote.selected as { upsell_ids?: string[]; maintenance_tier?: ServiceTier | null }) ?? {});
    const t = computeQuote(
      content,
      { upsell_ids: chosen.upsell_ids ?? [], maintenance_tier: chosen.maintenance_tier ?? null },
      monthlyFor
    );
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="size-8" />
          </div>
          <h1 className="mt-5 font-heading text-3xl font-black text-foreground">תודה, ההצעה אושרה!</h1>
          <p className="mt-2 text-muted-foreground">{quote.org_name ? `נתחיל לעבוד על ${quote.org_name}.` : "נתחיל לעבוד בקרוב."}</p>
          <div className="mt-6 space-y-1 rounded-2xl border border-border bg-card p-5 text-start">
            <PriceRow label="סה״כ חד-פעמי (כולל מע״מ)" value={shekel(withVat(t.oneTimeTotal, content.vat_pct))} big />
            {t.monthly > 0 && <PriceRow label="תחזוקה חודשית (כולל מע״מ)" value={`${shekel(withVat(t.monthly, content.vat_pct))}/חודש`} />}
          </div>
        </div>
      </Shell>
    );
  }

  const offeredTiers = (content.maintenance?.tiers ?? []).filter((t) => TIER_ORDER.includes(t));

  return (
    <Shell>
      {/* hero */}
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">הצעת מחיר · Studio Ori Guy</p>
        <h1 className="mt-2 font-heading text-4xl font-black text-foreground sm:text-5xl">{quote.title}</h1>
        {quote.client_name && <p className="mt-2 text-lg text-muted-foreground">עבור {quote.client_name}</p>}
        <p className="mt-1 text-sm text-muted-foreground">{SITE_TYPE_LABEL[quote.site_type as QuoteSiteType]}</p>
        {content.intro && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-foreground/90">{content.intro}</p>}
      </header>

      {/* what's included */}
      <Section title="מה כלול בפרויקט">
        <div className="grid gap-4 sm:grid-cols-2">
          <IncludedCard title="עמודים" items={content.pages.map((p) => p.name).filter(Boolean)} />
          <IncludedCard title="פיצ'רים ויכולות" items={content.features.map((f) => f.name).filter(Boolean)} />
        </div>
      </Section>

      {/* base price */}
      <Section title="המחיר">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">מחיר הפרויקט</p>
              <p className="font-heading text-4xl font-black text-primary">
                {shekel(withVat(totals!.oneTimeBase, content.vat_pct))}
              </p>
              <p className="text-xs text-muted-foreground">
                {shekel(totals!.oneTimeBase)} לא כולל מע״מ ({content.vat_pct}%)
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* upsells */}
      {content.upsells.length > 0 && (
        <Section title="שדרוגים מומלצים" subtitle="הוסיפו מה שמתאים, המחיר מתעדכן מיד">
          <div className="grid gap-3 sm:grid-cols-2">
            {content.upsells.map((u) => {
              const on = upsellIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setUpsellIds((ids) => (on ? ids.filter((x) => x !== u.id) : [...ids, u.id]))
                  }
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-4 text-start transition-all",
                    on ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{u.title}</span>
                      <span className="shrink-0 font-heading font-bold text-primary">+{shekel(u.price)}</span>
                    </span>
                    {u.desc && <span className="mt-0.5 block text-sm text-muted-foreground">{u.desc}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* maintenance */}
      {content.maintenance?.offer && offeredTiers.length > 0 && (
        <Section title="חבילת תחזוקה חודשית" subtitle="אופציונלי, שקט נפשי אחרי ההשקה. אפשר גם בלי.">
          <div className="grid gap-3 sm:grid-cols-3">
            {offeredTiers.map((t) => {
              const cfg = config[t];
              const on = maintTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMaintTier(on ? null : t)}
                  className={cn(
                    "rounded-2xl border p-4 text-start transition-all",
                    on ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-foreground">{cfg.name}</span>
                    {on && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="mt-1 font-heading text-xl font-black text-primary">
                    {shekel(cfg.price)}<span className="text-sm font-normal text-muted-foreground">/חודש</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{cfg.tagline}</p>
                </button>
              );
            })}
          </div>
          {maintTier && (
            <button type="button" onClick={() => setMaintTier(null)} className="mt-2 text-xs text-muted-foreground underline">
              ביטול בחירת תחזוקה
            </button>
          )}
        </Section>
      )}

      {/* running total */}
      <Section title="סיכום">
        <div className="space-y-1 rounded-2xl border border-border bg-card p-5">
          <PriceRow label="פרויקט + שדרוגים (לא כולל מע״מ)" value={shekel(totals!.oneTimeTotal)} />
          <PriceRow label={`מע״מ (${content.vat_pct}%)`} value={shekel(withVat(totals!.oneTimeTotal, content.vat_pct) - totals!.oneTimeTotal)} />
          <div className="border-t border-border pt-2">
            <PriceRow label="סה״כ חד-פעמי כולל מע״מ" value={shekel(withVat(totals!.oneTimeTotal, content.vat_pct))} big />
          </div>
          {totals!.monthly > 0 && (
            <PriceRow label="בנוסף, תחזוקה חודשית (כולל מע״מ)" value={`${shekel(withVat(totals!.monthly, content.vat_pct))}/חודש`} />
          )}
        </div>
      </Section>

      {/* signature */}
      <Section title="אישור וחתימה">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-1">
            <label htmlFor="q-name" className="text-sm text-muted-foreground">שם מלא</label>
            <input
              id="q-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              placeholder="השם שלך"
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">חתימה</span>
            <SignaturePad onChange={setSig} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-heading text-lg font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            אני מאשר את ההצעה
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> אישור ההצעה אינו מהווה חיוב, נתאם המשך מולך.
          </p>
        </div>
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:py-16">{children}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function IncludedCard({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 font-semibold text-foreground">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 shrink-0 text-primary" /> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriceRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn(big ? "font-semibold text-foreground" : "text-sm text-muted-foreground")}>{label}</span>
      <span className={cn("tabular-nums", big ? "font-heading text-2xl font-black text-primary" : "text-foreground")}>{value}</span>
    </div>
  );
}
