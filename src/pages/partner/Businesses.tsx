import { Link } from "react-router-dom";
import { Building2, ShieldCheck, LifeBuoy, FolderKanban, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMyMemberOrgs } from "@/hooks/useOrg";
import type { MemberOrgRow } from "@/types/database";

/**
 * Partner portal "העסקים שלי" tab: the businesses an admin has attached this
 * partner to as a member (see admin OrgMembersSection). Deliberately has no
 * lead-submission UI - a partner's own referral pipeline stays only under
 * "הגשת ליד"; helping run a client's business must never mix with the
 * partner's own commission-earning leads.
 */
export default function Businesses() {
  const { data: orgs, isLoading } = useMyMemberOrgs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="העסקים שלי"
        subtitle="עסקים שאורי שייך אותך אליהם, עם מה שאתה יכול/ה לראות ולעשות בכל אחד."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !orgs?.length ? (
        <EmptyState
          icon={Building2}
          title="עוד לא שויכת לעסק"
          description="כשאורי ישייך אותך לעסק, הוא יופיע כאן."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map((o) => (
            <BusinessCard key={o.org_id} org={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessCard({ org }: { org: MemberOrgRow }) {
  const chips = [
    org.can_service_view && { icon: ShieldCheck, label: "דשבורד שירות" },
    org.can_service_calls && { icon: LifeBuoy, label: "קריאות שירות" },
    org.can_files && { icon: FolderKanban, label: "קבצים" },
    org.can_approve && { icon: CheckCircle2, label: "אישורים" },
  ].filter((c): c is { icon: typeof ShieldCheck; label: string } => !!c);

  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Building2 className="size-5 text-muted-foreground" />
          {org.org_name}
        </p>
        {org.project_title && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{org.project_title}</p>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Badge key={c.label} variant="secondary">
              <c.icon className="size-3" /> {c.label}
            </Badge>
          ))}
        </div>
      )}

      {org.can_service_view ? (
        <Button asChild size="sm">
          <Link to={`/partner-portal/businesses/${org.org_id}`}>
            <ShieldCheck className="size-4" /> דשבורד השירות
          </Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">אין לך גישה לדשבורד השירות של העסק הזה.</p>
      )}
    </Card>
  );
}
