import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, MousePointerClick, Users, Briefcase, Wallet, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StudioContactCta } from "@/components/brand/StudioContactCta";
import { PartnerRewards } from "@/components/partner/PartnerRewards";
import { startPartnerTour } from "@/components/help/tour";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
import { usePartner } from "@/hooks/usePartner";
import { useAuth } from "@/hooks/useAuth";
import { toastError } from "@/hooks/use-toast";
import { leadStatusHe, leadStatusVariant, projectTypeHe } from "@/lib/status";
import { referralDisplay, referralUrl } from "@/lib/referral";


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

  useEffect(() => {
    if (isError) toastError("טעינת הנתונים נכשלה.");
  }, [isError]);

  // First-ever visit → play the partner orientation tour once (per user, per browser).
  useEffect(() => {
    if (isLoading || !user?.id) return;
    const key = `sog-partner-tour-${user.id}`;
    if (localStorage.getItem(key)) return;
    const t = setTimeout(() => {
      startPartnerTour();
      localStorage.setItem(key, "1");
    }, 900);
    return () => clearTimeout(t);
  }, [isLoading, user?.id]);

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const leads = data?.leads ?? [];
  const open = leads.filter((l) => !["closed", "not_relevant"].includes(l.status)).length;
  const closed = leads.filter((l) => l.status === "closed").length;
  const paid = leads
    .filter((l) => l.payment_confirmed_at)
    .reduce((sum, l) => sum + (l.commission_amount ?? 0), 0);

  const code = data?.profile?.referral_code ?? "";
  const refLink = code ? referralDisplay(code) : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={<SparklesText text={`שלום${firstName ? `, ${firstName}` : ""} 👋`} />}
        subtitle="הלידים שהגשת והעמלות שלך, במבט אחד."
        actions={
          <Button asChild data-tour="new-lead">
            <Link to="/partner-portal/new-lead">
              <Plus className="size-4" /> הגשת ליד
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div data-tour="partner-stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="לידים שהוגשו" value={leads.length} />
            <Stat icon={Briefcase} label="לידים פתוחים" value={open} />
            <Stat icon={Check} label="עסקאות שנסגרו" value={closed} />
            <Stat icon={Wallet} label="עמלה שהתקבלה" value={`₪${paid.toLocaleString("he-IL")}`} />
          </div>

          {/* Referral link */}
          <Card data-tour="referral-link" className="p-5">
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
          <div>
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
                  <Card key={l.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{l.lead_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.project_type ? projectTypeHe[l.project_type] : "-"} ·{" "}
                        {new Date(l.created_at).toLocaleDateString("he-IL")}
                        {l.commission_amount
                          ? ` · עמלה ₪${l.commission_amount.toLocaleString("he-IL")}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant={leadStatusVariant[l.status]}>
                      {leadStatusHe[l.status]}
                    </Badge>
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
