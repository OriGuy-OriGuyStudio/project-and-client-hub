import { FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { StudioContactCta } from "@/components/brand/StudioContactCta";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
import { startClientTour, whenUiIsClear } from "@/components/help/tour";
import { CLIENT_TOUR_VERSION } from "@/components/help/help-content";
import { GiftPopup } from "@/components/layout/GiftPopup";
import { WhatsNew } from "@/components/layout/WhatsNew";
import { PendingRedemptionsBanner } from "@/components/layout/PendingRedemptionsBanner";
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

  // First-ever visit → the full orientation tour (returning users get the
  // <WhatsNew/> modal instead). Waits for the loader + any popup to clear.
  useEffect(() => {
    if (isLoading || !user?.id) return;
    const seenKey = `sog-tour-${user.id}`;
    if (localStorage.getItem(seenKey)) return;
    return whenUiIsClear(() => {
      startClientTour();
      localStorage.setItem(seenKey, "1");
      localStorage.setItem(`sog-tour-ver-${user.id}`, String(CLIENT_TOUR_VERSION));
    });
  }, [isLoading, user?.id]);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div>
      <GiftPopup />
      <WhatsNew audience="client" />
      <PageHeader
        title={<SparklesText text={`שלום${firstName ? `, ${firstName}` : ""} 👋`} />}
        subtitle="הפרויקטים שלך במבט אחד"
      />
      <PendingRedemptionsBanner />

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
