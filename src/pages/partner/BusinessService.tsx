import { Link, useParams } from "react-router-dom";
import { ArrowRight, Building2, HeartHandshake } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMyMemberOrgs } from "@/hooks/useOrg";
import {
  useProjectService,
  useSiteMetrics,
  useMaintenanceLog,
  useServiceSummary,
} from "@/hooks/useService";
import { ServiceBoard } from "@/pages/client/Service";

/**
 * Partner-portal read-only view of a business's "השירות שלך" dashboard - the
 * partner analog of the admin's ServiceMirror. Only reachable for a business
 * where `my_member_orgs()` reports `can_service_view`; otherwise nothing else
 * is fetched, it just shows an empty state with a way back.
 */
export default function BusinessService() {
  const { orgId = "" } = useParams();
  const { data: orgs, isLoading: orgsLoading } = useMyMemberOrgs();

  const org = orgs?.find((o) => o.org_id === orgId);
  const allowed = !!org?.can_service_view;
  // Nothing else fetches unless the membership + capability check above passes.
  const projectId = allowed ? org?.project_id ?? null : null;

  const { data: svc, isLoading: svcLoading } = useProjectService(projectId);
  const { data: metrics = [], isLoading: metricsLoading } = useSiteMetrics(projectId, 30);
  const { data: log = [], isLoading: logLoading } = useMaintenanceLog(projectId, 40);
  const { data: summary, isLoading: summaryLoading } = useServiceSummary(projectId);

  const projectName = org?.project_title || org?.org_name || "העסק";
  const isLoading = orgsLoading || (allowed && (svcLoading || metricsLoading || logLoading || summaryLoading));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link to="/partner-portal/businesses">
          <ArrowRight className="size-4" /> העסקים שלי
        </Link>
      </Button>

      {orgsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      ) : !allowed ? (
        <EmptyState
          icon={Building2}
          title="אין לך גישה לדשבורד הזה."
          description="פנה/י לאורי אם את/ה חושב/ת שזו טעות."
          action={
            <Button asChild variant="secondary">
              <Link to="/partner-portal/businesses">
                <ArrowRight className="size-4" /> חזרה לעסקים שלי
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <PageHeader
            title={projectName}
            subtitle="בדיוק מה שהלקוח רואה בעמוד ״השירות שלך״ שלו, לצפייה בלבד."
          />

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-3xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : !svc ? (
            <EmptyState
              icon={HeartHandshake}
              title="אין חבילת שירות פעילה"
              description="לא משויכת חבילת ליווי ותחזוקה לפרויקט הזה, אז אין מה להציג כאן."
            />
          ) : (
            <ServiceBoard
              svc={svc}
              projectName={projectName}
              preview={{ metrics, log, summary: summary ?? null }}
              readOnly
            />
          )}
        </>
      )}
    </div>
  );
}
