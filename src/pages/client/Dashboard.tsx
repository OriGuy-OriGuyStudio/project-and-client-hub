import { ClipboardList, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { StudioContactCta } from "@/components/brand/StudioContactCta";
import { SparklesText } from "@/components/ui/sparkles-text";
import { WavePath } from "@/components/ui/wave-path";
import { supabase } from "@/lib/supabase";
import { templateByKey } from "@/lib/discovery";
import { startClientTour, whenUiIsClear } from "@/components/help/tour";
import { CLIENT_TOUR_VERSION } from "@/components/help/help-content";
import { GiftPopup } from "@/components/layout/GiftPopup";
import { WhatsNew } from "@/components/layout/WhatsNew";
import { PendingRedemptionsBanner } from "@/components/layout/PendingRedemptionsBanner";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
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
      <AnnouncementBanner />

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

      <DiscoverySummaries />

      <WavePath className="my-10" />

      <div data-tour="contact">
        <StudioContactCta />
      </div>
    </div>
  );
}

interface DiscoveryRow {
  id: string;
  title: string;
  template_key: string;
  share_token: string;
  created_at: string;
}

/** Completed discovery-call summaries the studio shared with this client. */
function DiscoverySummaries() {
  const { data } = useQuery({
    queryKey: ["my-discovery-sessions"],
    queryFn: async (): Promise<DiscoveryRow[]> => {
      const { data, error } = await supabase.rpc("get_my_discovery_sessions");
      if (error) throw error;
      return (data as DiscoveryRow[]) ?? [];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">
        סיכומי שיחות אפיון
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => (
          <a key={s.id} href={`/discovery/${s.share_token}`} target="_blank" rel="noreferrer noopener">
            <Card className="group h-full p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" />
                <h3 className="min-w-0 truncate font-heading text-base font-semibold text-foreground">
                  {s.title}
                </h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {templateByKey(s.template_key).label} ·{" "}
                {new Date(s.created_at).toLocaleDateString("he-IL")}
              </p>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
