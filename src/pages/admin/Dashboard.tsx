import { useEffect } from "react";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSections } from "@/components/project/ProjectSections";
import { EmptyState } from "@/components/ui/empty-state";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card } from "@/components/ui/card";
import { AdminTasksPanel } from "@/components/admin/AdminTasksPanel";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { groupProjects } from "@/lib/projectGroups";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { toastError } from "@/hooks/use-toast";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <AnimatedNumber
        value={value}
        className="mt-1 block font-heading text-3xl font-bold text-foreground"
      />
    </Card>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data: projects, isLoading, isError } = useProjects();
  const { data: clients } = useClients();
  const { unreadProjectIds } = useNotifications();
  const groups = groupProjects(projects ?? [], clients?.active);

  useEffect(() => {
    if (isError) toastError("טעינת הפרויקטים נכשלה.");
  }, [isError]);

  const active = projects?.filter((p) => p.status === "active").length ?? 0;
  const onHold = projects?.filter((p) => p.status === "on_hold").length ?? 0;
  const completed = projects?.filter((p) => p.status === "completed").length ?? 0;

  const firstName = profile?.full_name?.split(" ")[0] || "אורי";

  return (
    <div>
      <PageHeader
        title={<SparklesText text={`היי ${firstName} 👋`} />}
        subtitle="הנה מה שקורה בסטודיו עכשיו. כל הפרויקטים, במקום אחד."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="פרויקטים פעילים" value={active} />
        <StatCard label="בהמתנה" value={onHold} />
        <StatCard label="הושלמו" value={completed} />
      </div>

      <div className="mt-6">
        <AdminTasksPanel />
      </div>

      <WavePath className="my-8" />

      {isLoading ? (
        <CenteredLoader label="טוען פרויקטים…" />
      ) : projects && projects.length > 0 ? (
        <ProjectSections groups={groups} unread={unreadProjectIds} />
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="אין עדיין פרויקטים"
          description="צור פרויקט חדש כדי להתחיל."
        />
      )}
    </div>
  );
}
