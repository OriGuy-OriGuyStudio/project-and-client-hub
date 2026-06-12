import { FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { StudioContactCta } from "@/components/brand/StudioContactCta";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
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
        title={<SparklesText text={`שלום${firstName ? `, ${firstName}` : ""} 👋`} />}
        subtitle="הפרויקטים שלך במבט אחד"
      />

      {isLoading ? (
        <CenteredLoader label="טוען את הפרויקטים שלך…" />
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

      <WavePath className="my-10" />

      <StudioContactCta />
    </div>
  );
}
