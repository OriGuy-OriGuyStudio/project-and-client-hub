import { FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { StudioContactCta } from "@/components/brand/StudioContactCta";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
import { startClientTour } from "@/components/help/tour";
import { GiftPopup } from "@/components/layout/GiftPopup";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { toastError } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { data: projects, isLoading, isError } = useProjects();

  useEffect(() => {
    if (isError) toastError("טעינת הפרויקטים נכשלה.");
  }, [isError]);

  // First-ever visit → play the orientation tour once (per user, per browser).
  useEffect(() => {
    if (isLoading || !user?.id) return;
    const key = `sog-tour-${user.id}`;
    if (localStorage.getItem(key)) return;
    const t = setTimeout(() => {
      startClientTour();
      localStorage.setItem(key, "1");
    }, 900);
    return () => clearTimeout(t);
  }, [isLoading, user?.id]);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div>
      <GiftPopup />
      <PageHeader
        title={<SparklesText text={`שלום${firstName ? `, ${firstName}` : ""} 👋`} />}
        subtitle="הפרויקטים שלך במבט אחד"
      />

      <div data-tour="projects">
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
      </div>

      <WavePath className="my-10" />

      <div data-tour="contact">
        <StudioContactCta />
      </div>
    </div>
  );
}
