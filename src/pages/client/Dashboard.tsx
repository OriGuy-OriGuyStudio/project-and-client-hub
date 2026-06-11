import { FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { toastError } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: projects, isLoading, isError } = useProjects();

  useEffect(() => {
    if (isError) toastError("טעינת הפרויקטים נכשלה.");
  }, [isError]);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div>
      <PageHeader
        title={`שלום${firstName ? `, ${firstName}` : ""} 👋`}
        subtitle="הפרויקטים שלך במבט אחד"
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="אין עדיין פרויקטים"
          description="כשהסטודיו יפתח עבורך פרויקט, הוא יופיע כאן."
        />
      )}
    </div>
  );
}
