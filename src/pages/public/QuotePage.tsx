import { lazy, Suspense, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Gift,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";
import { usePublicQuote } from "@/hooks/useQuotes";
import { usePlanConfig } from "@/lib/plan-config";
import { celebrateBig } from "@/lib/confetti";
import { TIER_ORDER, type ServiceTier } from "@/lib/service-plans";
import {
  bonusesTotal,
  computeQuote,
  paymentSplit,
  shekel,
  withVat,
  SITE_TYPE_LABEL,
  type QuoteContent,
  type QuoteSiteType,
} from "@/lib/quote";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

const Aurora = lazy(() => import("@/components/ui/aurora"));
const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const EASE = [0.16, 1, 0.3, 1] as const;
const AURORA_STOPS = ["#2f4a17", "#B4D670", "#7fae2b"];

/* The theme tokens are hex vars with no <alpha-value>, so Tailwind's `/opacity`
 * modifiers (bg-primary/10, text-primary/20, ...) silently render nothing. All
 * green tints therefore go through color-mix inline styles, which DO resolve. */
const tintBg = (pct: number): React.CSSProperties => ({ backgroundColor: `color-mix(in srgb, var(--primary) ${pct}%, transparent)` });
const tintBorder = (pct: number): React.CSSProperties => ({ borderColor: `color-mix(in srgb, var(--primary) ${pct}%, transparent)` });
const tintText = (pct: number): React.CSSProperties => ({ color: `color-mix(in srgb, var(--primary) ${pct}%, transparent)` });
const glowBg = (shape: string, pct = 20): React.CSSProperties => ({
  background: `radial-gradient(${shape}, color-mix(in srgb, var(--primary) ${pct}%, transparent), transparent)`,
});
const chipStyle: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--primary) 25%, transparent)",
};

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

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
    celebrateBig();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const clientFirst = (quote.client_name || "").trim().split(/\s+/)[0] || "";
  const vatPct = content.vat_pct ?? 18;
  const bonusesSum = bonusesTotal(content);
  const dateStr = formatDate(quote.created_at);

  if (alreadySigned) {
    const chosen = justSigned
      ? { upsell_ids: upsellIds, maintenance_tier: maintTier }
      : ((quote.selected as { upsell_ids?: string[]; maintenance_tier?: ServiceTier | null }) ?? {});
    const t = computeQuote(
      content,
      { upsell_ids: chosen.upsell_ids ?? [], maintenance_tier: chosen.maintenance_tier ?? null },
      monthlyFor
    );
    const inclVat = withVat(t.netTotal, vatPct);
    const split = paymentSplit(inclVat, content);
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-20 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mx-auto flex size-20 items-center justify-center rounded-full text-primary"
            style={chipStyle}
          >
            <Check className="size-10" />
          </motion.div>
          <h1 className="mt-6 font-heading text-3xl font-black text-foreground sm:text-4xl">
            תודה{clientFirst ? ` ${clientFirst}` : ""}, ההצעה אושרה!
          </h1>
          <p className="mt-2 text-muted-foreground">
            {quote.org_name ? `נתחיל לעבוד על ${quote.org_name}.` : "נתחיל לעבוד בקרוב."} אשלח לך את הצעדים הבאים.
          </p>
          <Bezel glow className="mt-8 text-start">
            <div className="space-y-1 p-6">
              <PriceRow label="סה״כ חד-פעמי (כולל מע״מ)" value={shekel(inclVat)} big />
              <PriceRow label={`מקדמה (${split.depositPct}%)`} value={shekel(split.deposit)} />
              <PriceRow label="יתרה לפני העלייה לאוויר" value={shekel(split.rest)} />
              {t.monthly > 0 && <PriceRow label="תחזוקה חודשית (כולל מע״מ)" value={`${shekel(t.monthly)}/חודש`} />}
            </div>
          </Bezel>
        </div>
      </Shell>
    );
  }

  const offeredTiers = (content.maintenance?.tiers ?? []).filter((t) => TIER_ORDER.includes(t));
  const pages = (content.pages ?? []).map((p) => p.name).filter(Boolean);
  const features = (content.features ?? []).map((f) => f.name).filter(Boolean);
  const phases = content.phases ?? [];
  const diffs = content.differentiators ?? [];
  const bonuses = content.bonuses ?? [];
  const steps = content.next_steps ?? [];
  const faq = content.faq ?? [];
  const legal = content.legal ?? [];
  const liveInclVat = withVat(totals!.netTotal, vatPct);
  const split = paymentSplit(liveInclVat, content);
  const discountLabel = content.discount?.label?.trim() || "הנחה";

  return (
    <Shell>
      <PrintStyles />

      {/* masthead / letterhead */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <span className="font-heading text-sm font-bold tracking-tight text-foreground">Studio Ori Guy</span>
        <span className="text-xs text-muted-foreground">
          הצעת מחיר{content.version ? ` · ${content.version}` : ""}
          {dateStr ? ` · ${dateStr}` : ""}
        </span>
      </div>

      {/* hero */}
      <header className="relative -mt-4 overflow-hidden pb-8 pt-6">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72 opacity-70"
          style={{
            maskImage: "linear-gradient(to bottom, black 5%, transparent 92%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 5%, transparent 92%)",
          }}
        >
          <Suspense fallback={null}>
            <Aurora colorStops={AURORA_STOPS} amplitude={1.0} blend={0.55} speed={0.45} />
          </Suspense>
        </div>
        <div className="pointer-events-none absolute -top-4 right-0 -z-10 h-64 w-2/3" style={glowBg("60% 70% at 70% 20%", 16)} />
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-6 bg-primary" /> הצעה אישית
          </span>
          <h1 className="mt-4 bg-gradient-to-b from-foreground via-foreground to-foreground/55 bg-clip-text pb-1 font-heading text-5xl font-black leading-[1.08] tracking-tight text-transparent sm:text-6xl">
            {quote.title}
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            {quote.client_name ? `מוגש עבור ${quote.client_name}` : "מוגש עבורך"}
            {dateStr ? ` · ${dateStr}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-3 py-1">{SITE_TYPE_LABEL[quote.site_type as QuoteSiteType]}</span>
            {content.validity_days ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
                <Clock className="size-3.5" /> תקפה ל-{content.validity_days} ימים
              </span>
            ) : null}
          </div>
        </motion.div>
      </header>

      {/* narrative */}
      {content.intro?.trim() && (
        <Section title="קצת על הפרויקט">
          <p className="max-w-2xl whitespace-pre-wrap text-lg leading-relaxed text-foreground/85 sm:text-xl">{content.intro}</p>
        </Section>
      )}

      {/* differentiators */}
      {diffs.length > 0 && (
        <Section title="למה לעבוד איתי">
          <div className="grid gap-4 sm:grid-cols-3">
            {diffs.map((d, i) => (
              <RevealItem key={d.id} i={i}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-primary">
                  <span className="pointer-events-none absolute -top-6 end-3 select-none font-heading text-7xl font-black" style={tintText(12)}>
                    {i + 1}
                  </span>
                  <span className="relative flex size-11 items-center justify-center rounded-xl text-primary" style={chipStyle}>
                    <Sparkles className="size-5" />
                  </span>
                  <p className="relative mt-4 font-heading text-lg font-bold text-foreground">{d.title}</p>
                  {d.desc && <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>}
                </div>
              </RevealItem>
            ))}
          </div>
        </Section>
      )}

      {/* what's included */}
      {(pages.length > 0 || features.length > 0) && (
        <Section title="מה כלול בפרויקט">
          <div className="grid gap-4 sm:grid-cols-2">
            <IncludedCard title="עמודים" items={pages} />
            <IncludedCard title="פיצ'רים ויכולות" items={features} />
          </div>
        </Section>
      )}

      {/* timeline */}
      {phases.length > 0 && (
        <Section title="שלבים ולו״ז">
          <ol className="relative space-y-5 border-s-2 ps-7" style={tintBorder(22)}>
            {phases.map((p, i) => (
              <RevealItem key={p.id} i={i}>
                <li className="relative">
                  <span className="absolute -start-[2.15rem] flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-4 ring-background">
                    {i + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-lg font-bold text-foreground">{p.name}</p>
                    {p.duration?.trim() && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{p.duration}</span>
                    )}
                  </div>
                  {p.desc && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>}
                </li>
              </RevealItem>
            ))}
          </ol>
        </Section>
      )}

      {/* upsells */}
      {(content.upsells ?? []).length > 0 && (
        <Section title="שדרוגים מומלצים" subtitle="הוסיפו מה שמתאים, המחיר מתעדכן מיד">
          <div className="grid gap-3 sm:grid-cols-2">
            {content.upsells.map((u, i) => {
              const on = upsellIds.includes(u.id);
              return (
                <RevealItem key={u.id} i={i}>
                  <button
                    type="button"
                    onClick={() => setUpsellIds((ids) => (on ? ids.filter((x) => x !== u.id) : [...ids, u.id]))}
                    style={on ? { ...tintBg(10), boxShadow: "0 16px 44px -16px rgba(180,214,112,0.45)" } : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.99]",
                      on ? "border-primary" : "border-border bg-card hover:border-primary"
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
                </RevealItem>
              );
            })}
          </div>
        </Section>
      )}

      {/* maintenance */}
      {content.maintenance?.offer && offeredTiers.length > 0 && (
        <Section title="חבילת תחזוקה חודשית" subtitle="אופציונלי, שקט נפשי אחרי ההשקה. אפשר גם בלי.">
          <div className="grid gap-3 sm:grid-cols-3">
            {offeredTiers.map((t, i) => {
              const cfg = config[t];
              const on = maintTier === t;
              return (
                <RevealItem key={t} i={i}>
                  <button
                    type="button"
                    onClick={() => setMaintTier(on ? null : t)}
                    style={on ? { ...tintBg(10), boxShadow: "0 16px 44px -16px rgba(180,214,112,0.4)" } : undefined}
                    className={cn(
                      "w-full rounded-2xl border p-5 text-start transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 active:scale-[0.99]",
                      on ? "border-primary" : "border-border bg-card hover:border-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-foreground">{cfg.name}</span>
                      {on && <Check className="size-4 text-primary" />}
                    </div>
                    <p className="mt-1 font-heading text-2xl font-black text-primary">
                      {shekel(cfg.price)}<span className="text-sm font-normal text-muted-foreground">/חודש</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{cfg.tagline}</p>
                  </button>
                </RevealItem>
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

      {/* bonuses value-stack */}
      {bonuses.length > 0 && (
        <Section title="בונוסים במתנה" subtitle="נכללים בהצעה, בלי תוספת תשלום">
          <Bezel tinted>
            <div className="p-6">
              <ul className="space-y-3.5">
                {bonuses.map((b) => (
                  <li key={b.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-primary" style={chipStyle}>
                      <Gift className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-foreground">{b.name}</span>
                        {b.value > 0 && <span className="shrink-0 text-sm text-muted-foreground line-through">{shekel(b.value)}</span>}
                      </div>
                      {b.desc && <p className="text-sm text-muted-foreground">{b.desc}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {bonusesSum > 0 && (
                <div className="mt-5 flex items-baseline justify-between border-t pt-4" style={tintBorder(20)}>
                  <span className="font-heading font-bold text-foreground">שווי הבונוסים במתנה</span>
                  <span className="font-heading text-2xl font-black text-primary">{shekel(bonusesSum)}</span>
                </div>
              )}
            </div>
          </Bezel>
        </Section>
      )}

      {/* price + payment */}
      <Section title="מחיר ותשלום">
        <Bezel glow>
          <div className="space-y-1 p-6">
            {bonusesSum > 0 && (
              <PriceRow label="שווי כולל של הפרויקט והבונוסים" value={shekel(totals!.oneTimeBase + bonusesSum)} strike />
            )}
            {bonusesSum > 0 && <PriceRow label="הבונוסים, במתנה" value={`- ${shekel(bonusesSum)}`} accent />}
            <PriceRow label="מחיר הפרויקט (לא כולל מע״מ)" value={shekel(totals!.oneTimeBase)} />
            {totals!.upsellsTotal > 0 && <PriceRow label="שדרוגים שנבחרו" value={shekel(totals!.upsellsTotal)} />}
            {totals!.discountAmount > 0 && <PriceRow label={discountLabel} value={`- ${shekel(totals!.discountAmount)}`} accent />}
            <PriceRow label={`מע״מ (${vatPct}%)`} value={shekel(liveInclVat - totals!.netTotal)} />
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-heading text-lg font-bold text-foreground">סה״כ חד-פעמי כולל מע״מ</span>
              <CountUp
                to={liveInclVat}
                format={shekel}
                className="font-heading text-5xl font-black tracking-tight text-primary sm:text-6xl"
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground">מקדמה לאישור ({split.depositPct}%)</p>
                <p className="mt-0.5 font-heading text-xl font-black text-foreground">{shekel(split.deposit)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground">יתרה לפני העלייה לאוויר</p>
                <p className="mt-0.5 font-heading text-xl font-black text-foreground">{shekel(split.rest)}</p>
              </div>
            </div>
            {content.payment?.terms?.trim() && <p className="pt-2 text-center text-xs text-muted-foreground">{content.payment.terms}</p>}
            {totals!.monthly > 0 && (
              <p className="pt-1 text-center text-sm text-muted-foreground">
                בנוסף, תחזוקה חודשית {shekel(totals!.monthly)}/חודש (כולל מע״מ)
              </p>
            )}
          </div>
        </Bezel>
      </Section>

      {/* next steps */}
      {steps.length > 0 && (
        <Section title="מה קורה אחרי שתאשר">
          <div className="grid gap-3 sm:grid-cols-4">
            {steps.map((s, i) => (
              <RevealItem key={s.id} i={i}>
                <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex size-9 items-center justify-center rounded-full font-heading font-bold text-primary" style={chipStyle}>
                    {i + 1}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">{s.text}</p>
                </div>
              </RevealItem>
            ))}
          </div>
        </Section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <Section title="שאלות נפוצות">
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {faq.map((f) => (
              <FaqItem key={f.id} q={f.q} a={f.a} />
            ))}
          </div>
        </Section>
      )}

      {/* legal */}
      {legal.length > 0 && (
        <Section title="סעיפים משפטיים">
          <ol className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {legal.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0">{i + 1}.</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* signature */}
      <section id="sign" className="scroll-mt-6">
        <Reveal>
          <SectionHead title="אישור וחתימה" subtitle="חתמו כאן ונתחיל." />
          <Bezel glow>
            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <label htmlFor="q-name" className="text-sm text-muted-foreground">שם מלא</label>
                <input
                  id="q-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground outline-none transition-colors focus:border-primary"
                  placeholder="השם שלך"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">חתימה</span>
                <SignaturePad onChange={setSig} />
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="group flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 font-heading text-lg font-bold text-primary-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <span>אני מאשר את ההצעה · {shekel(liveInclVat)}</span>
                    <span className="flex size-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.14)" }}>
                      <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
                    </span>
                  </>
                )}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" /> אישור ההצעה אינו מהווה חיוב, נתאם המשך מולך.
              </p>
            </div>
          </Bezel>
        </Reveal>
      </section>

      {/* footer */}
      <footer className="no-print flex flex-col items-center gap-3 border-t border-border pt-6 text-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <FileText className="size-4" /> שמירה כ-PDF
        </button>
        <p className="text-xs text-muted-foreground">Studio Ori Guy · עיצוב ובניית אתרים בהתאמה אישית</p>
      </footer>

      {/* sticky mobile total + CTA */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 px-4 py-2.5 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] leading-none text-muted-foreground">סה״כ כולל מע״מ</p>
            <p className="font-heading text-lg font-black text-primary">{shekel(liveInclVat)}</p>
          </div>
          <a href="#sign" className="rounded-full bg-primary px-5 py-2.5 font-heading text-sm font-bold text-primary-foreground active:scale-[0.98]">
            לאישור וחתימה
          </a>
        </div>
      </div>

      <WhatsAppFab title={quote.title} />
      <div className="h-16 sm:hidden" aria-hidden />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <GrainOverlay />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[55vh]" style={glowBg("70% 100% at 50% 0%", 12)} />
      <div className="pointer-events-none fixed -bottom-48 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary opacity-[0.08] blur-[120px]" />
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-6 sm:space-y-16 sm:py-10">{children}</div>
    </div>
  );
}

/** Fixed film-grain texture for cinematic depth (brand-neutral, very subtle). */
function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] mix-blend-soft-light"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/** Double-bezel panel: an outer machined shell around an inner content core.
 *  `glow` adds a green halo for the page's climactic moments (price, signature). */
function Bezel({
  children,
  tinted,
  glow,
  className,
}: {
  children: React.ReactNode;
  tinted?: boolean;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative rounded-[1.75rem] border p-1.5", glow ? "border-transparent" : "border-border bg-card", className)}
      style={glow ? { ...tintBg(5), ...tintBorder(30) } : undefined}
    >
      {glow && <div className="pointer-events-none absolute -inset-x-8 -top-12 -z-0 h-36" style={glowBg("55% 100% at 50% 0%", 22)} />}
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.4rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          tinted ? "border" : glow ? "bg-card/85 backdrop-blur-sm" : "bg-card"
        )}
        style={tinted ? { ...tintBg(9), ...tintBorder(20) } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function RevealItem({ children, i }: { children: React.ReactNode; i: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(i, 6) * 0.06, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Section heading with a short brand rule above it (formal document rhythm). */
function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <span className="mb-3 block h-[3px] w-10 rounded-full bg-primary" />
      <h2 className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section>
        <SectionHead title={title} subtitle={subtitle} />
        {children}
      </section>
    </Reveal>
  );
}

function IncludedCard({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <p className="mb-3 font-heading font-bold text-foreground">{title}</p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-primary" style={chipStyle}>
              <Check className="size-3" />
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-start"
      >
        <span className="font-semibold text-foreground">{q}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.35, ease: EASE }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </div>
  );
}

function PriceRow({
  label,
  value,
  big,
  accent,
  strike,
}: {
  label: string;
  value: string;
  big?: boolean;
  accent?: boolean;
  strike?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn(big ? "font-semibold text-foreground" : "text-sm text-muted-foreground")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          big ? "font-heading text-2xl font-black text-primary" : accent ? "text-primary" : "text-foreground",
          strike && "text-muted-foreground line-through"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function WhatsAppFab({ title }: { title: string }) {
  if (!WHATSAPP) return null;
  const href = `https://wa.me/${String(WHATSAPP).replace(/\D/g, "")}?text=${encodeURIComponent(`היי אורי, יש לי שאלה על ההצעה "${title}"`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="שאלה בוואטסאפ"
      className="no-print fixed bottom-20 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-heading text-sm font-bold text-primary-foreground shadow-[0_12px_40px_-12px_rgba(180,214,112,0.6)] transition-transform duration-300 hover:scale-105 active:scale-95 sm:bottom-6"
      style={{ insetInlineStart: "1rem" }}
    >
      <MessageCircle className="size-5" /> שאלה? דבר איתי
    </a>
  );
}

/** Print rules: hide interactive-only chrome so "שמירה כ-PDF" looks clean. */
function PrintStyles() {
  return (
    <style>{`@media print {
      .no-print { display: none !important; }
      * { box-shadow: none !important; }
    }`}</style>
  );
}
