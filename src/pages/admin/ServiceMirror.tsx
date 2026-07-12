import { Link, useParams } from "react-router-dom";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useProjects } from "@/hooks/useProjects";
import {
  useProjectService,
  useSiteMetrics,
  useMaintenanceLog,
  useServiceSummary,
} from "@/hooks/useService";
import { ServiceBoard } from "@/pages/client/Service";

/**
 * Admin "צפה כלקוח" mirror of the client's "השירות שלך" dashboard: the exact
 * same `ServiceBoard`, fed from a snapshot built out of admin-readable hooks,
 * in `preview` + `readOnly` mode so it never fires the client-only (RLS-gated
 * member-capabilities/finance/agreement) queries and never renders write
 * actions (open a service call, etc). What Ori sees here is exactly what the
 * client sees on their own page.
 */
export default function ServiceMirror() {
  const { projectId = "" } = useParams();
  const { data: projects = [] } = useProjects();
  const { data: svc, isLoading: svcLoading } = useProjectService(projectId);
  const { data: metrics = [], isLoading: metricsLoading } = useSiteMetrics(projectId, 30);
  const { data: log = [], isLoading: logLoading } = useMaintenanceLog(projectId, 40);
  const { data: summary, isLoading: summaryLoading } = useServiceSummary(projectId);

  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.business_name || project?.title || "האתר שלך";
  const isLoading = svcLoading || metricsLoading || logLoading || summaryLoading;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link to="/admin/maintenance">
          <ArrowRight className="size-4" /> לכל חבילות התחזוקה
        </Link>
      </Button>

      <PageHeader
        title={`תצוגת לקוח: ${projectName}`}
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
    </div>
  );
}
