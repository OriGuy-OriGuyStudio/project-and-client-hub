import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AlertCircle, Sparkles, BookOpen, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useProject } from "@/hooks/useProject";
import { useAuth } from "@/hooks/useAuth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectHero } from "@/components/project/ProjectHero";
import { BrandGuidelines } from "@/components/brand/BrandGuidelines";
import { SiteBlueprintPanel } from "@/components/project/SiteBlueprintPanel";
import { ContentBriefSection } from "@/components/project/ContentBriefSection";
import { ProgressTimeline } from "@/components/project/ProgressTimeline";
import { ApprovalsSection } from "@/components/project/ApprovalsSection";
import { DevFeedbackSection } from "@/components/project/DevFeedbackSection";
import { ChecklistSection } from "@/components/project/ChecklistSection";
import { TasksSection } from "@/components/tasks/TasksSection";
import { DocsSection } from "@/components/project/DocsSection";
import { FileManager } from "@/components/files/FileManager";
import { PaymentsSection } from "@/components/payments/PaymentsSection";
import { useMyCapabilities } from "@/hooks/useMyCapabilities";
import { WarrantyCountdown } from "@/components/warranty/WarrantyCountdown";
import { ActivityFeed } from "@/components/project/ActivityFeed";
import { MaintenanceLogEditor } from "@/components/service/MaintenanceLogEditor";
import { InternalChat } from "@/components/chat/InternalChat";
import {
  NotifyClientProvider,
  NotifyClientButton,
} from "@/components/project/NotifyClient";
import { SectionNav } from "@/components/layout/SectionNav";

gsap.registerPlugin(ScrollTrigger);

/** Small "updated by client" ribbon shown above a section the client just changed. */
function SectionUpdated({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground shadow">
      <Sparkles className="size-3" /> עודכן ע״י הלקוח
    </span>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { isAdmin, user } = useAuth();
  // Capability gating for a client viewing their own project (admin bypasses).
  const caps = useMyCapabilities(isAdmin ? null : id ?? null);
  const reduced = usePrefersReducedMotion();
  const { data, isLoading, isError } = useProject(id);
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  // Client contact details, for the "notify client" flow (admin only).
  const { data: client } = useQuery({
    enabled: isAdmin && !!data?.project.client_id,
    queryKey: ["client-contact", data?.project.client_id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", data!.project.client_id)
        .single();
      return profile;
    },
  });

  // The client sees the guide entry only once it holds content (a published
  // article or saved login details). The admin always sees it, to author it.
  const { data: guideHasContent } = useQuery({
    enabled: !isAdmin && !!data?.project.id,
    queryKey: ["guide-has-content", data?.project.id],
    queryFn: async () => {
      const pid = data!.project.id;
      const [{ count: articles }, { count: creds }] = await Promise.all([
        supabase.from("guide_articles").select("id", { count: "exact", head: true }).eq("project_id", pid),
        supabase.from("project_site_credentials").select("id", { count: "exact", head: true }).eq("project_id", pid),
      ]);
      return (articles ?? 0) + (creds ?? 0) > 0;
    },
  });
  // Which sections the client updated since the admin last looked. Snapshotted
  // once on open (before we mark the notifications read) so the badges persist
  // for this visit even though the nav/card badges clear immediately.
  const [updatedSections, setUpdatedSections] = useState<Set<string>>(new Set());

  // Opening a project: snapshot which sections changed, then clear its admin
  // "new update" notifications (so the nav + card badges go away).
  useEffect(() => {
    if (!isAdmin || !id) return;
    let cancelled = false;
    (async () => {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("type")
        .eq("project_id", id)
        .eq("is_read", false);
      if (!cancelled && notifs?.length) {
        setUpdatedSections(new Set(notifs.map((n) => n.type)));
      }
      await supabase.rpc("mark_project_notifications_read", { p_project_id: id });
      if (!cancelled) qc.invalidateQueries({ queryKey: ["notifications"] });
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, id, qc]);

  // Scroll-triggered section reveals.
  useEffect(() => {
    if (reduced || !data || !containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, [reduced, data]);

  if (isLoading) {
    return <CenteredLoader label="טוען את הפרויקט…" />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="הפרויקט לא נמצא"
        description="ייתכן שהקישור שגוי או שאין לך הרשאה לצפות בפרויקט זה."
      />
    );
  }

  const { project, brand, colors } = data;
  const actorId = user?.id ?? null;

  const content = (
    <div ref={containerRef} className="space-y-6">
      <div data-reveal>
        <ProjectHero project={project} brand={brand} colors={colors} isAdmin={isAdmin} />
        {isAdmin && (
          <div className="mt-3 flex justify-end">
            <NotifyClientButton />
          </div>
        )}
      </div>

      <SectionNav />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {isAdmin && (
            <div data-reveal className="scroll-mt-20">
              <MaintenanceLogEditor projectId={project.id} />
            </div>
          )}
          {/* Most relevant to the client after handover, so it leads the page.
              Client sees it only once it has content; admin always (to author). */}
          {(isAdmin || guideHasContent) && (
            <div data-reveal data-section className="scroll-mt-20">
              <Link to={`/projects/${project.id}/guide`} className="group block">
                <Card className="flex items-center gap-4 p-5 transition-colors hover:border-primary/40">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-lg font-semibold text-foreground">מדריך שימוש לאתר</h2>
                    <p className="text-sm text-muted-foreground">פרטי התחברות ומדריכים להפעלת האתר שלך</p>
                  </div>
                  <ChevronLeft className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
                </Card>
              </Link>
            </div>
          )}
          <div data-reveal data-section className="scroll-mt-20">
            <BrandGuidelines brand={brand} colors={colors} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <SiteBlueprintPanel projectId={project.id} isAdmin={isAdmin} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <ContentBriefSection projectId={project.id} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <ProgressTimeline projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("approval")} />
            <ApprovalsSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <DevFeedbackSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("checklist")} />
            <ChecklistSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <TasksSection
              projectId={project.id}
              isAdmin={isAdmin}
              clientId={project.client_id}
              adminId={actorId}
            />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("file")} />
            <FileManager
              projectId={project.id}
              isAdmin={isAdmin}
              actorId={actorId}
              zipName={brand?.business_name || project.title}
            />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <DocsSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          {(isAdmin || caps.finance) && (
            <div data-reveal data-section className="scroll-mt-20">
              <PaymentsSection projectId={project.id} isAdmin={isAdmin} />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div data-reveal data-section="אחריות" className="scroll-mt-20">
            <WarrantyCountdown project={project} />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("message")} />
            <InternalChat
              projectId={project.id}
              projectTitle={brand?.business_name || project.title}
              senderId={actorId}
              isAdmin={isAdmin}
            />
          </div>
          <div data-reveal data-section className="scroll-mt-20">
            <ActivityFeed projectId={project.id} />
          </div>
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return (
      <NotifyClientProvider
        contact={{
          projectId: project.id,
          projectTitle: brand?.business_name || project.title,
          clientId: project.client_id,
          clientName: client?.full_name ?? null,
          clientPhone: client?.phone ?? null,
          clientEmail: client?.email ?? null,
        }}
      >
        {content}
      </NotifyClientProvider>
    );
  }

  return content;
}
