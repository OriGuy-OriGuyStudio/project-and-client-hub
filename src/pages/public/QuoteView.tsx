import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, FileQuestion, MessageCircleOff, Sparkles } from "lucide-react";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarkQuoteViewed, useQuotePublic, quoteExpiry } from "@/hooks/useQuotePublic";

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

  // Normal (draft/sent, not expired): minimal hero for now, content sections
  // land in Task 4, pricing in Task 5, signing in Task 6.
  const greeting = data.client_name ? `שלום, ${data.client_name}` : "שלום";
  return (
    <Shell>
      <div className="pt-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> הצעת מחיר
          </span>
          <h1 className="mt-4 font-heading text-3xl font-black sm:text-4xl">{greeting}</h1>
          <p className="mt-2 text-lg text-foreground">{data.title}</p>
        </div>

        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">תוכן ההצעה נטען בשלבים הבאים (בבנייה)</p>
        </div>
      </div>
    </Shell>
  );
}
