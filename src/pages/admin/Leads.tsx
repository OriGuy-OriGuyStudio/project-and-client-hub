import { useState } from "react";
import { Inbox, Settings2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminLeadsSection } from "@/components/partner/AdminLeadsSection";
import { StatusPipeline } from "@/components/partner/StatusPipeline";
import { ManageReferralDialog } from "@/pages/admin/Referrals";
import { useAdminReferrals, type AdminReferral } from "@/hooks/useAdminReferrals";
import { referralStatusHe, referralStatusVariant } from "@/lib/status";

/** One place for every incoming lead: partner-submitted leads and client referrals. */
export default function Leads() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="כל הלידים"
        subtitle="כל הלידים במקום אחד, חלוקה ללידים משותפים ולהפניות מלקוחות."
      />
      <AdminLeadsSection />
      <ClientReferralsSection />
    </div>
  );
}

function ClientReferralsSection() {
  const { data, isLoading } = useAdminReferrals();
  const [active, setActive] = useState<AdminReferral | null>(null);
  const refs = data?.referrals ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-brand-cyan-base" />
        <h2 className="font-heading text-lg font-bold text-foreground">לידים מלקוחות (הפניות)</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !refs.length ? (
        <EmptyState icon={Inbox} title="אין עדיין הפניות מלקוחות" />
      ) : (
        <div className="space-y-2">
          {refs.map((r) => (
            <Card key={r.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {r.referred_name}
                    <span className="text-muted-foreground"> · {r.referrer_name}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                    {r.deal_value ? ` · עסקה ₪${r.deal_value.toLocaleString("he-IL")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={referralStatusVariant[r.status]}>{referralStatusHe[r.status]}</Badge>
                  <Button variant="ghost" size="icon" aria-label="ניהול" onClick={() => setActive(r)}>
                    <Settings2 className="size-4" />
                  </Button>
                </div>
              </div>
              <StatusPipeline status={r.status} />
            </Card>
          ))}
        </div>
      )}

      <ManageReferralDialog referral={active} onClose={() => setActive(null)} />
    </section>
  );
}
