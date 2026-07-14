import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const EASE = [0.16, 1, 0.3, 1] as const;

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
            className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary ring-8 ring-primary/5"
          >
            <Check className="size-10" />
          </motion.div>
          <h1 className="mt-6 font-heading text-3xl font-black text-foreground sm:text-4xl">
            תודה{clientFirst ? ` ${clientFirst}` : ""}, ההצעה אושרה!
          </h1>
          <p className="mt-2 text-muted-foreground">
            {quote.org_name ? `נתחיל לעבוד על ${quote.org_name}.` : "נתחיל לעבוד בקרוב."} אשלח לך את הצעדים הבאים.
          </p>
          <Bezel className="mt-8 text-start">
            <div className="space-y-1 p-6">
              <PriceRow label="סה״כ חד-פעמי (כולל מע״מ)" value={shekel(inclVat)} big />
              <PriceRow label={`מקדמה (${split.depositPct}%)`} value={shekel(split.deposit)} />
              <PriceRow label="יתרה לפני העלייה לאוויר" value={shekel(split.rest)} />
              {t.monthly > 0 && <PriceRow label="תחזוקה חודשית (כולל מע״מ)" value={`${shekel(withVat(t.monthly, vatPct))}/חודש`} />}
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

      {/* hero */}
      <header className="relative -mx-4 overflow-hidden px-4 pb-14 pt-10 sm:pt-14">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/12 via-primary/5 to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            הצעת מחיר · Studio Ori Guy
          </span>
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.05] text-foreground sm:text-6xl">{quote.title}</h1>
          {quote.client_name && <p className="mt-3 text-xl text-muted-foreground">עבור {quote.client_name}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">{SITE_TYPE_LABEL[quote.site_type as QuoteSiteType]}</span>
            {content.version && <span className="rounded-full bg-muted px-3 py-1">{content.version}</span>}
            {content.validity_days ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
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
                <div className="h-full rounded-3xl border border-border bg-card p-5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Sparkles className="size-5" />
                  </span>
                  <p className="mt-3 font-heading text-lg font-bold text-foreground">{d.title}</p>
                  {d.desc && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>}
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
          <ol className="relative space-y-5 border-s-2 border-primary/20 ps-7">
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
                    className={cn(
                      "flex w-full items-start gap-3 rounded-3xl border p-4 text-start transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.99]",
                      on ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)),0_12px_40px_-12px_hsl(var(--primary)/0.4)]" : "border-border bg-card hover:border-primary/40"
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
                    className={cn(
                      "w-full rounded-3xl border p-5 text-start transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 active:scale-[0.99]",
                      on ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:border-primary/40"
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
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
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
                <div className="mt-5 flex items-baseline justify-between border-t border-primary/20 pt-4">
                  <span className="font-heading font-bold text-foreground">שווי הבונוסים במתנה</span>
                  <span className="font-heading text-2xl font-black text-primary">{shekel(bonusesSum)}</span>
                </div>
              )}
            </div>
          </Bezel>
        </Section>
      )}

      {/* price + payment */}
      <Section title="מחיר ותשלום" eyebrow="השורה התחתונה">
        <Bezel>
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
              <span className="font-heading text-4xl font-black text-primary sm:text-5xl">{shekel(liveInclVat)}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">מקדמה לאישור ({split.depositPct}%)</p>
                <p className="mt-0.5 font-heading text-xl font-black text-foreground">{shekel(split.deposit)}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">יתרה לפני העלייה לאוויר</p>
                <p className="mt-0.5 font-heading text-xl font-black text-foreground">{shekel(split.rest)}</p>
              </div>
            </div>
            {content.payment?.terms?.trim() && <p className="pt-2 text-center text-xs text-muted-foreground">{content.payment.terms}</p>}
            {totals!.monthly > 0 && (
              <p className="pt-1 text-center text-sm text-muted-foreground">
                בנוסף, תחזוקה חודשית {shekel(withVat(totals!.monthly, vatPct))}/חודש (כולל מע״מ)
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
                <div className="h-full rounded-3xl border border-border bg-card p-5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 font-heading font-bold text-primary">
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
          <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
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
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              יוצאים לדרך
            </span>
            <h2 className="mt-3 font-heading text-2xl font-bold text-foreground sm:text-3xl">אישור וחתימה</h2>
            <p className="text-sm text-muted-foreground">חתמו כאן ונתחיל.</p>
          </div>
          <Bezel tinted>
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
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
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

      {/* footer action */}
      <div className="no-print flex justify-center pt-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <FileText className="size-4" /> שמירה כ-PDF
        </button>
      </div>

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
    <div dir="rtl" className="relative min-h-[100dvh] bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[40vh] bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]" />
      <div className="mx-auto max-w-3xl space-y-14 px-4 py-6 sm:space-y-20 sm:py-12">{children}</div>
    </div>
  );
}

/** Double-bezel panel: an outer machined shell around an inner content core. */
function Bezel({ children, tinted, className }: { children: React.ReactNode; tinted?: boolean; className?: string }) {
  return (
    <div className={cn("rounded-[2rem] border border-border bg-foreground/[0.02] p-1.5", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-[1.55rem] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]",
          tinted ? "border border-primary/20 bg-primary/[0.06]" : "bg-card"
        )}
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

function Section({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className="space-y-4">
        <div>
          {eyebrow && (
            <span className="mb-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </span>
          )}
          <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </section>
    </Reveal>
  );
}

function IncludedCard({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="mb-3 font-heading font-bold text-foreground">{title}</p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
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
      className="no-print fixed bottom-20 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-heading text-sm font-bold text-primary-foreground shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.6)] transition-transform duration-300 hover:scale-105 active:scale-95 sm:bottom-6"
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
