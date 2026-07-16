import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, FileQuestion, MessageCircleOff } from "lucide-react";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarkQuoteViewed, useQuotePublic, quoteExpiry, type QuotePublic } from "@/hooks/useQuotePublic";
import { quoteTotals, type QuoteSelected } from "@/lib/quote-v2";
import { DEFAULT_MULTIPLIERS } from "@/lib/quote-pricing";
import { cn } from "@/lib/utils";
import SideRays from "@/components/reactbits/SideRays";
import { QuoteHero } from "@/pages/public/quote/QuoteHero";
import { QuoteMiniNav, type QuoteNavItem } from "@/pages/public/quote/QuoteMiniNav";
import { SideNav } from "@/pages/public/quote/SideNav";
import { IncludedSection } from "@/pages/public/quote/IncludedSection";
import { PricingSection } from "@/pages/public/quote/PricingSection";
import { WhySection } from "@/pages/public/quote/WhySection";
import { ProcessSection } from "@/pages/public/quote/ProcessSection";
import { BonusesSection } from "@/pages/public/quote/BonusesSection";
import { TestimonialSection } from "@/pages/public/quote/TestimonialSection";
import { FaqSection } from "@/pages/public/quote/FaqSection";
import { NextStepsSection } from "@/pages/public/quote/NextStepsSection";
import { LegalSection } from "@/pages/public/quote/LegalSection";
import { SignSection } from "@/pages/public/quote/SignSection";

/** `get_quote_public` returns `selected` as `{}` when nothing was ever
 *  persisted (never-signed quote). Normalizes that into a real, empty
 *  `QuoteSelected` so the pricing/sign UI never has to special-case it. */
function normalizeSelected(raw: QuotePublic["selected"] | null | undefined): QuoteSelected {
  if (raw && "upsell_ids" in raw) return raw as QuoteSelected;
  return { upsell_ids: [], optional_ids: [], maintenance_tier: null };
}

const STUDIO_WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;

function waHref(text: string): string | undefined {
  if (!STUDIO_WHATSAPP) return undefined;
  return `https://wa.me/${String(STUDIO_WHATSAPP).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Simple WhatsApp (falling back to mailto if no studio number is configured)
 *  contact link, reused across the not-found/declined/expired states. */
function ContactCta({ text, label = "דברו איתי בוואטסאפ" }: { text: string; label?: string }) {
  const href = waHref(text);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-h-10 items-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-[color:var(--ink,#0a0623)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {label}
      </a>
    );
  }
  return (
    <a
      href="mailto:origuy@origuystudio.com"
      className="inline-flex min-h-10 items-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-[color:var(--ink,#0a0623)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      כתבו לי במייל
    </a>
  );
}

/** Full-bleed ambient light-ray backdrop for the top of the page, sitting
 *  behind ALL content (z-0, content is z-10 above it) rather than scoped to
 *  the hero card , reads as page atmosphere, not a lit box behind the
 *  headings. Fades to transparent toward the bottom via a mask so it never
 *  competes with body copy further down. Skipped entirely under
 *  `prefers-reduced-motion`, same as every other animated flourish on this
 *  signing document. */
function PageBackdrop() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[80vh]"
      style={{
        maskImage: "linear-gradient(to bottom, black, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
      }}
    >
      <SideRays
        speed={1.2}
        rayColor1="#b4d670"
        rayColor2="#96c8ff"
        intensity={1.6}
        spread={1.6}
        origin="top-right"
        saturation={1.1}
        blend={0.6}
        falloff={1.8}
        opacity={0.5}
      />
    </div>
  );
}

/** `wide` widens the page container to fit the desktop `SideNav` alongside
 *  the normal reading-width content (used only by `QuoteNormalView`); every
 *  other state (loading/not-found/declined/expired) keeps the original
 *  narrower column. */
function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    // The quote page is designed dark-only (direction ג) , force the dark
    // token set regardless of the viewer's OS/app theme, so a light-mode
    // client still gets the intended premium dark document.
    <div dir="rtl" className="dark relative min-h-screen bg-background text-foreground">
      <PageBackdrop />
      <div
        className={cn(
          "relative z-10 mx-auto flex min-h-screen w-full flex-col px-4 py-10",
          wide ? "max-w-5xl" : "max-w-3xl",
        )}
      >
        <div className="flex-1">{children}</div>
        <p className="mt-10 text-center text-xs text-muted-foreground">Ori Guy Studio</p>
      </div>
    </div>
  );
}

export default function QuoteView() {
  const { token } = useParams();
  const { data, isLoading } = useQuotePublic(token);
  const markViewed = useMarkQuoteViewed();
  const viewedFor = useRef<string | null>(null);

  // Stamp viewed_at once per token, only for a live (draft/sent) quote. The
  // RPC itself is idempotent (only fires the first time), but we also guard
  // client-side so we never re-fire on a re-render or refetch of the same
  // token. Fire-and-forget: a failure here must never block the read.
  useEffect(() => {
    if (!token || !data) return;
    if (data.status !== "draft" && data.status !== "sent") return;
    if (viewedFor.current === token) return;
    viewedFor.current = token;
    markViewed.mutate(token, { onError: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data?.status]);

  if (isLoading) {
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center">
          <CenteredLoader label="טוען את ההצעה…" />
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center">
          <EmptyState
            icon={FileQuestion}
            title="ההצעה לא נמצאה"
            description="אם קיבלתם קישור ממני והוא לא עובד, אפשר לכתוב לי בוואטסאפ."
            action={<ContactCta text="היי אורי, קיבלתי קישור להצעת מחיר שלא עובד" />}
          />
        </div>
      </Shell>
    );
  }

  if (data.status === "declined") {
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center">
          <EmptyState
            icon={MessageCircleOff}
            title="ההצעה סומנה כנדחתה"
            description="אם זו טעות או שיש שאלה על ההצעה, אפשר לכתוב לי ונדבר."
            action={<ContactCta text={`היי אורי, לגבי ההצעה "${data.title}"`} />}
          />
        </div>
      </Shell>
    );
  }

  // A signed quote is resolved, not expired , it skips the expiry check
  // below (quoteExpiry only flags `status === 'sent'`) and renders through
  // QuoteNormalView with read-only pricing + a success card instead of the
  // sign form (see the `readOnly` branch there).
  const { expired, expiresAt } = quoteExpiry(data);
  if (expired) {
    const expiredDate = expiresAt
      ? expiresAt.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
      : null;
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center">
          <EmptyState
            icon={Clock}
            title="ההצעה הזו פגה"
            description={
              expiredDate
                ? `ההצעה הייתה בתוקף עד ${expiredDate}. אם עדיין רלוונטי, אפשר לכתוב לי ואשלח הצעה מעודכנת.`
                : "תוקף ההצעה פג. אם עדיין רלוונטי, אפשר לכתוב לי ואשלח הצעה מעודכנת."
            }
            action={<ContactCta text={`היי אורי, ההצעה "${data.title}" פגה, אשמח להצעה מעודכנת`} />}
          />
        </div>
      </Shell>
    );
  }

  // Normal (draft/sent not expired, or signed): full content sections, with
  // either the interactive pricing + sign form, or (once signed) read-only
  // pricing + a success card in its place.
  return <QuoteNormalView data={data} token={token!} />;
}

/** The "normal" render: hero, mini-nav, and every content section that
 *  actually has content, for a draft/sent (not expired) OR signed quote.
 *  Split out from the state switch above purely so hooks (the nav-items
 *  memo) don't run conditionally. */
function QuoteNormalView({
  data,
  token,
}: {
  data: NonNullable<ReturnType<typeof useQuotePublic>["data"]>;
  token: string;
}) {
  const content = data.content;

  // Selection state lives here (not in PricingSection) so Task 6's sign flow
  // can read the same `selected` when it submits. `sent` quotes start from
  // an empty selection; a `draft` quote being previewed by Ori keeps the
  // same behavior. Read-only mode never mutates this, so the initializer
  // running once (from `data.selected`, which is stable for a given token)
  // is enough , no need to resync on refetch.
  const [selected, setSelected] = useState<QuoteSelected>(() => normalizeSelected(data.selected));
  const readOnly = data.status === "signed";

  // Same single `quoteTotals` call PricingSection makes (same content,
  // selected, multipliers, floor, monthlyFor args) , the desktop SideNav's
  // mini summary must never compute its own numbers, only mirror this one.
  const totals = useMemo(
    () => quoteTotals(content, selected, DEFAULT_MULTIPLIERS, 0, () => 0),
    [content, selected],
  );
  const selectedTier = selected.maintenance_tier
    ? (content.maintenance?.tiers ?? []).find((t) => t.key === selected.maintenance_tier)
    : undefined;

  const validityLabel = useMemo(() => {
    const base = data.sent_at ?? data.created_at;
    const days = Number(content?.validity_days) || 0;
    if (!base || days <= 0) return null;
    const until = new Date(new Date(base).getTime() + days * 86_400_000);
    const dateHe = until.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
    return `ההצעה בתוקף עד ${dateHe}`;
  }, [data.sent_at, data.created_at, content?.validity_days]);

  const hasIncluded = (content.scope ?? []).some((it) => !it.optional);
  const navItems: QuoteNavItem[] = [
    hasIncluded && { id: "included", label: "מה מקבלים" },
    { id: "pricing", label: "המחיר" },
    (content.differentiators ?? []).length > 0 && { id: "why", label: "למה איתי" },
    (content.phases ?? []).length > 0 && { id: "process", label: "איך זה עובד" },
    (content.bonuses ?? []).length > 0 && { id: "bonuses", label: "מתנות" },
    !!content.testimonial?.quote && { id: "testimonial", label: "המלצה" },
    (content.faq ?? []).length > 0 && { id: "faq", label: "שאלות" },
    (content.legal ?? []).length > 0 && { id: "legal", label: "תנאים" },
    { id: "sign", label: readOnly ? "האישור שלך" : "אישור וחתימה" },
  ].filter((x): x is QuoteNavItem => !!x);

  return (
    <Shell wide>
      {/* Aside FIRST in DOM order , under `dir="rtl"` (set on Shell's outer
         div) that lands it on the visual right, matching the reference
         layout, with zero explicit `flex-row-reverse`. `lg:` only: below
         that breakpoint this is a plain block stack and SideNav renders
         nothing (`hidden ... lg:block`). */}
      <div className="lg:flex lg:items-start lg:gap-8">
        <SideNav
          items={navItems}
          net={totals.net}
          total={totals.total}
          tierName={selectedTier?.name}
          tierPrice={selectedTier?.price}
          signed={readOnly}
        />

        <div className="min-w-0 flex-1">
          <QuoteHero
            clientName={data.client_name}
            title={data.title}
            narrative={content.narrative ?? ""}
            validityLabel={validityLabel}
          />

          {/* Mobile/tablet nav only , the desktop SideNav replaces it at
             `lg`, never both at once. */}
          <div className="lg:hidden">
            <QuoteMiniNav items={navItems} />
          </div>

          {hasIncluded && (
            <IncludedSection
              type={content.type}
              scope={content.scope ?? []}
              finalPrice={content.final_price ?? 0}
              showBreakdown={!!content.show_breakdown}
            />
          )}

          <PricingSection
            content={content}
            selected={selected}
            onSelectedChange={setSelected}
            readOnly={readOnly}
          />

          <WhySection items={content.differentiators ?? []} />
          <ProcessSection phases={content.phases ?? []} />
          <BonusesSection bonuses={content.bonuses ?? []} />
          <TestimonialSection testimonial={content.testimonial ?? null} />
          <FaqSection faq={content.faq ?? []} />
          <NextStepsSection steps={content.next_steps ?? []} />
          <LegalSection legal={content.legal ?? []} />

          {/* SignSection , Task 6 */}
          {readOnly ? (
            <SignedSuccessCard signedName={data.signed_name} signedAt={data.signed_at} />
          ) : (
            <SignSection token={token} content={content} selected={selected} />
          )}

          {/* Reserves space so the mobile sticky pricing bar (rendered by
             PricingSection, position: fixed) never overlaps the last section. */}
          <div aria-hidden className="h-20 sm:hidden" />
        </div>
      </div>
    </Shell>
  );
}

/** Read-only success card shown in the sign form's place once a quote is
 *  signed , same slot, same "sign" nav anchor, so the page structure stays
 *  identical whether the client is signing or reviewing what they already
 *  signed. */
function SignedSuccessCard({ signedName, signedAt }: { signedName: string | null; signedAt: string | null }) {
  const dateHe = signedAt
    ? new Date(signedAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <section id="sign" className="scroll-mt-24 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center">
        <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-4 font-heading text-2xl font-black sm:text-3xl">ההצעה אושרה ✓</h2>
        {signedName && (
          <p className="mt-3 text-base text-foreground">
            נחתם על ידי <b>{signedName}</b>
            {dateHe && <> · {dateHe}</>}
          </p>
        )}
        <p className="mt-4 text-base text-muted-foreground">קיבלתי את האישור, אני אחזור אליך עם השלבים הבאים.</p>
      </div>
    </section>
  );
}
