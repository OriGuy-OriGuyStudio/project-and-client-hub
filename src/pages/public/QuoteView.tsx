import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, FileQuestion, MessageCircleOff } from "lucide-react";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarkQuoteViewed, useQuotePublic, quoteExpiry, type QuotePublic } from "@/hooks/useQuotePublic";
import type { QuoteSelected } from "@/lib/quote-v2";
import { QuoteHero } from "@/pages/public/quote/QuoteHero";
import { QuoteMiniNav, type QuoteNavItem } from "@/pages/public/quote/QuoteMiniNav";
import { IncludedSection } from "@/pages/public/quote/IncludedSection";
import { PricingSection } from "@/pages/public/quote/PricingSection";
import { WhySection } from "@/pages/public/quote/WhySection";
import { ProcessSection } from "@/pages/public/quote/ProcessSection";
import { BonusesSection } from "@/pages/public/quote/BonusesSection";
import { TestimonialSection } from "@/pages/public/quote/TestimonialSection";
import { FaqSection } from "@/pages/public/quote/FaqSection";
import { NextStepsSection } from "@/pages/public/quote/NextStepsSection";
import { LegalSection } from "@/pages/public/quote/LegalSection";

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
        className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-[color:var(--ink,#0a0623)]"
      >
        {label}
      </a>
    );
  }
  return (
    <a
      href="mailto:origuy@origuystudio.com"
      className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-[color:var(--ink,#0a0623)]"
    >
      כתבו לי במייל
    </a>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10">
        <div className="flex-1">{children}</div>
        <p className="mt-10 text-center text-xs text-muted-foreground">Studio Ori Guy</p>
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
            description="אם קיבלת קישור ממני והוא לא עובד, כתוב לי בוואטסאפ."
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
            description="אם זו טעות או שיש לך שאלה על ההצעה, כתוב לי ונדבר."
            action={<ContactCta text={`היי אורי, לגבי ההצעה "${data.title}"`} />}
          />
        </div>
      </Shell>
    );
  }

  if (data.status === "signed") {
    const dateHe = data.signed_at
      ? new Date(data.signed_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
      : null;
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center">
          <div className="w-full rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-black">ההצעה אושרה</h1>
            <p className="mt-2 text-sm text-muted-foreground">{data.title}</p>
            {data.signed_name && (
              <p className="mt-4 text-sm text-foreground">
                נחתם על ידי <b>{data.signed_name}</b>
                {dateHe && <> · {dateHe}</>}
              </p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">תודה, אני יוצא לדרך. נדבר בקרוב.</p>
          </div>
        </div>
      </Shell>
    );
  }

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
                ? `ההצעה הייתה בתוקף עד ${expiredDate}. אם עדיין רלוונטי, כתוב לי ואני אשלח הצעה מעודכנת.`
                : "תוקף ההצעה פג. אם עדיין רלוונטי, כתוב לי ואני אשלח הצעה מעודכנת."
            }
            action={<ContactCta text={`היי אורי, ההצעה "${data.title}" פגה, אשמח להצעה מעודכנת`} />}
          />
        </div>
      </Shell>
    );
  }

  // Normal (draft/sent, not expired): full content sections. Interactive
  // pricing (Task 5) and signing (Task 6) mount at the marked points below.
  return <QuoteNormalView data={data} />;
}

/** The "normal" (draft/sent, not expired) render: hero, mini-nav, and every
 *  content section that actually has content. Split out from the state
 *  switch above purely so hooks (the nav-items memo) don't run conditionally. */
function QuoteNormalView({ data }: { data: NonNullable<ReturnType<typeof useQuotePublic>["data"]> }) {
  const content = data.content;

  // Selection state lives here (not in PricingSection) so Task 6's sign flow
  // can read the same `selected` when it submits. `sent` quotes start from
  // an empty selection; a `draft` quote being previewed by Ori keeps the
  // same behavior. Read-only mode never mutates this, so the initializer
  // running once (from `data.selected`, which is stable for a given token)
  // is enough , no need to resync on refetch.
  const [selected, setSelected] = useState<QuoteSelected>(() => normalizeSelected(data.selected));
  const readOnly = data.status === "signed";

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
    (content.faq ?? []).length > 0 && { id: "faq", label: "שאלות" },
    (content.legal ?? []).length > 0 && { id: "legal", label: "תנאים" },
  ].filter((x): x is QuoteNavItem => !!x);

  return (
    <Shell>
      <QuoteHero
        clientName={data.client_name}
        title={data.title}
        narrative={content.narrative ?? ""}
        validityLabel={validityLabel}
      />

      <QuoteMiniNav items={navItems} />

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

      {/* Reserves space so the mobile sticky pricing bar (rendered by
         PricingSection, position: fixed) never overlaps the last section. */}
      <div aria-hidden className="h-20 sm:hidden" />
    </Shell>
  );
}
