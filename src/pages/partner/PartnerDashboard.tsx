import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, MousePointerClick, Users, Briefcase, Wallet, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionNav } from "@/components/layout/SectionNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StudioContactCta } from "@/components/brand/StudioContactCta";
import { PartnerRewards } from "@/components/partner/PartnerRewards";
import { startPartnerTour, whenUiIsClear } from "@/components/help/tour";
import { PARTNER_TOUR_VERSION } from "@/components/help/help-content";
import { WhatsNew } from "@/components/layout/WhatsNew";
import { GiftPopup } from "@/components/layout/GiftPopup";
import { PendingRedemptionsBanner } from "@/components/layout/PendingRedemptionsBanner";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
import { usePartner } from "@/hooks/usePartner";
import { useCuriousBadge } from "@/hooks/useCuriousBadge";
import { useAuth } from "@/hooks/useAuth";
import { toastError } from "@/hooks/use-toast";
import { leadStatusHe, leadStatusVariant, projectTypeHe } from "@/lib/status";
import { referralDisplay, referralUrl } from "@/lib/referral";
import { celebrateBig } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PartnerLead, PartnerLeadStatus } from "@/types/database";

// The funnel a lead moves through, shown as a mini progress bar on each card so
// the partner sees exactly where things stand (instead of a single status word).
const LEAD_STAGES: { key: PartnerLeadStatus; label: string }[] = [
  { key: "submitted", label: "התקבל" },
  { key: "awaiting_intro", label: "ממתין לשיחה" },
  { key: "intro_done", label: "שיחה בוצעה" },
  { key: "quote_sent", label: "הצעה נשלחה" },
  { key: "client_approved", label: "לקוח אישר" },
  { key: "closed", label: "אושר לעבודה" },
];

function LeadPipeline({ status }: { status: PartnerLeadStatus }) {
  if (status === "not_relevant") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        הליד נפל / לא רלוונטי
      </p>
    );
  }
  const current = Math.max(0, LEAD_STAGES.findIndex((s) => s.key === status));
  return (
    <div className="flex items-end gap-1.5">
      {LEAD_STAGES.map((s, i) => {
        const done = i <= current;
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "text-[10px] leading-tight",
                i === current ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            <div className={cn("h-1.5 w-full rounded-full", done ? "bg-primary" : "bg-border")} />
          </div>
        );
      })}
    </div>
  );
}


type Celebration = { id: string; kind: "won" | "paid"; amount: number; name: string };

const seenKey = (kind: "won" | "paid", id: string) => `sog-lead-${kind}-${id}`;
const wasCelebrated = (kind: "won" | "paid", id: string) =>
  localStorage.getItem(seenKey(kind, id)) === "1";

// One pending celebration per lead: "paid" (money transferred) takes priority over
// "won" (approved, awaiting payment). Only events not yet celebrated on this device.
function buildCelebrations(leads: PartnerLead[]): Celebration[] {
  const out: Celebration[] = [];
  for (const l of leads) {
    const amount = l.commission_amount ?? 0;
    if (amount <= 0) continue;
    if (l.payment_confirmed_at) {
      if (!wasCelebrated("paid", l.id)) out.push({ id: l.id, kind: "paid", amount, name: l.lead_name });
    } else if (l.status === "closed") {
      if (!wasCelebrated("won", l.id)) out.push({ id: l.id, kind: "won", amount, name: l.lead_name });
    }
  }
  return out;
}

/** Celebrates a partner's lead the moment it's approved (pending payout) and again,
 *  with fireworks, when the commission is actually paid. Shown once per device. */
function LeadCelebration({ leads }: { leads: PartnerLead[] }) {
  const queue = useMemo(() => buildCelebrations(leads), [leads]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [queue]);
  const active = queue[idx] ?? null;

  useEffect(() => {
    if (active?.kind === "paid") celebrateBig();
  }, [active?.id, active?.kind]);

  function dismiss() {
    if (active) {
      markSeenForAdvance(active);
    }
    setIdx((i) => i + 1);
  }
  function markSeenForAdvance(c: Celebration) {
    localStorage.setItem(seenKey(c.kind, c.id), "1");
    // Once paid is celebrated, never show the "approved, pending" popup for it.
    if (c.kind === "paid") localStorage.setItem(seenKey("won", c.id), "1");
  }

  if (!active) return null;
  const won = active.kind === "won";
  const ils = `₪${active.amount.toLocaleString("he-IL")}`;
  return (
    <Dialog open onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="text-center sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle>{won ? "מזל טוב, העסקה אושרה! 🎉" : "הכסף בדרך אליך! 🎉"}</DialogTitle>
          <DialogDescription>
            {won
              ? `העסקה של ${active.name} אושרה לעבודה.`
              : `העמלה על ${active.name} שולמה. תודה על השותפות!`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <p className="text-sm text-muted-foreground">{won ? "עמלה שממתינה לך" : "סכום ששולם"}</p>
          <p className="font-heading text-3xl font-black text-primary">{ils}</p>
          {won && <p className="mt-1 text-xs text-muted-foreground">אעדכן אותך ברגע שהכסף יועבר.</p>}
        </div>
        <DialogFooter>
          <Button onClick={dismiss} className="w-full">
            {won ? "מעולה" : "אש, תודה 🙌"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 font-heading text-2xl font-black text-foreground">{value}</p>
    </Card>
  );
}

export default function PartnerDashboard() {
  const { profile, user } = useAuth();
  const { data, isLoading, isError } = usePartner();
  const { data: isCurious } = useCuriousBadge();

  useEffect(() => {
    if (isError) toastError("טעינת הנתונים נכשלה.");
  }, [isError]);

  // First-ever visit → the full orientation tour (returning partners get the
  // <WhatsNew/> modal instead). Waits for the loader + any popup to clear.
  useEffect(() => {
    if (isLoading || !user?.id) return;
    const seenKey = `sog-partner-tour-${user.id}`;
    if (localStorage.getItem(seenKey)) return;
    return whenUiIsClear(() => {
      startPartnerTour();
      localStorage.setItem(seenKey, "1");
      localStorage.setItem(`sog-partner-tour-ver-${user.id}`, String(PARTNER_TOUR_VERSION));
    });
  }, [isLoading, user?.id]);

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const leads = data?.leads ?? [];
  const open = leads.filter((l) => !["closed", "not_relevant"].includes(l.status)).length;
  const closed = leads.filter((l) => l.status === "closed").length;
  const paid = leads
    .filter((l) => l.payment_confirmed_at)
    .reduce((sum, l) => sum + (l.commission_amount ?? 0), 0);
  // Closed deals whose commission hasn't been paid out yet — money on the way.
  const pending = leads
    .filter((l) => l.status === "closed" && !l.payment_confirmed_at)
    .reduce((sum, l) => sum + (l.commission_amount ?? 0), 0);

  const code = data?.profile?.referral_code ?? "";
  const refLink = code ? referralDisplay(code) : "";

  return (
    <div className="space-y-6">
      <LeadCelebration leads={leads} />
      <GiftPopup />
      <WhatsNew audience="partner" />
      <PendingRedemptionsBanner />
      <AnnouncementBanner />
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <SparklesText text={`שלום${firstName ? `, ${firstName}` : ""} 👋`} />
            {isCurious && (
              <Badge variant="success" title="גילית את הסוד הנסתר בפורטל">
                🔭 סקרן
              </Badge>
            )}
          </span>
        }
        subtitle="הלידים שהגשת והעמלות שלך, במבט אחד."
        actions={
          <Button asChild data-tour="new-lead">
            <Link to="/partner-portal/new-lead">
              <Plus className="size-4" /> הגשת ליד
            </Link>
          </Button>
        }
      />

      <SectionNav />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div data-tour="partner-stats" data-section="במבט אחד" className="scroll-mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat icon={Users} label="לידים שהוגשו" value={leads.length} />
            <Stat icon={Briefcase} label="לידים פתוחים" value={open} />
            <Stat icon={Check} label="עסקאות שנסגרו" value={closed} />
            <Stat icon={Wallet} label="עמלה שהתקבלה" value={`₪${paid.toLocaleString("he-IL")}`} />
            <Stat icon={Wallet} label="ממתין לתשלום" value={`₪${pending.toLocaleString("he-IL")}`} />
          </div>

          {/* Referral link */}
          <Card data-tour="referral-link" data-section="לינק ההפניה" className="scroll-mt-20 p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MousePointerClick className="size-4" />
              <span className="text-sm">לינק ההפניה האישי שלך</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="flex-1 rounded-xl border border-border bg-field px-3 py-2 font-mono-code text-sm text-foreground">
                {refLink || "-"}
              </code>
              <CopyButton
                content={code ? referralUrl(code) : ""}
                label="העתקת לינק"
                toastMessage="הלינק הועתק"
                disabled={!refLink}
              />

            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {data?.clicks ?? 0} כניסות דרך הלינק · {data?.conversions ?? 0} הפכו לליד
            </p>
          </Card>

          {/* Leads table */}
          <div data-tour="partner-leads" data-section className="scroll-mt-20">
            <h2 className="mb-3 font-heading text-lg font-bold text-foreground">
              הלידים שלך
            </h2>
            {leads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="עוד לא הגשת לידים"
                description="כל ליד שתפנה יופיע כאן עם הסטטוס והעמלה הצפויה."
                action={
                  <Button asChild>
                    <Link to="/partner-portal/new-lead">
                      <Plus className="size-4" /> הגשת ליד ראשון
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <Card key={l.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{l.lead_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.project_type ? projectTypeHe[l.project_type] : "-"} ·{" "}
                          {new Date(l.created_at).toLocaleDateString("he-IL")}
                          {l.commission_amount
                            ? ` · עמלה ₪${l.commission_amount.toLocaleString("he-IL")}`
                            : ""}
                          {l.status === "closed" && l.commission_amount
                            ? l.payment_confirmed_at
                              ? " · שולמה ✓"
                              : " · ממתינה לתשלום"
                            : ""}
                        </p>
                      </div>
                      <Badge variant={leadStatusVariant[l.status]} className="shrink-0">
                        {leadStatusHe[l.status]}
                      </Badge>
                    </div>
                    <LeadPipeline status={l.status} />
                  </Card>
                ))}
              </div>
            )}
          </div>

          <WavePath className="my-4" />
          <div data-tour="partner-rewards">
            <PartnerRewards />
          </div>
        </>
      )}

      <WavePath className="my-4" />
      <StudioContactCta />
    </div>
  );
}
