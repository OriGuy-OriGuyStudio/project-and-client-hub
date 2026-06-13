import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AlertCircle, Sparkles } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { useAuth } from "@/hooks/useAuth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectHero } from "@/components/project/ProjectHero";
import { BrandGuidelines } from "@/components/brand/BrandGuidelines";
import { ProgressTimeline } from "@/components/project/ProgressTimeline";
import { ApprovalsSection } from "@/components/project/ApprovalsSection";
import { ChecklistSection } from "@/components/project/ChecklistSection";
import { TasksSection } from "@/components/tasks/TasksSection";
import { DocsSection } from "@/components/project/DocsSection";
import { FileManager } from "@/components/files/FileManager";
import { PaymentsSection } from "@/components/payments/PaymentsSection";
import { WarrantyCountdown } from "@/components/warranty/WarrantyCountdown";
import { ActivityFeed } from "@/components/project/ActivityFeed";
import { InternalChat } from "@/components/chat/InternalChat";
import {
  NotifyClientProvider,
  NotifyClientButton,
} from "@/components/project/NotifyClient";
import { SectionNav, type NavSection } from "@/components/layout/SectionNav";

const PROJECT_SECTIONS: NavSection[] = [
  { id: "sec-brand", label: "מותג" },
  { id: "sec-roadmap", label: "שלבים" },
  { id: "sec-approvals", label: "אישורים" },
  { id: "sec-checklist", label: "צ׳קליסט" },
  { id: "sec-tasks", label: "משימות" },
  { id: "sec-files", label: "קבצים" },
  { id: "sec-docs", label: "מסמכים" },
  { id: "sec-payments", label: "תשלומים" },
  { id: "sec-warranty", label: "אחריות" },
  { id: "sec-chat", label: "צ׳אט" },
  { id: "sec-activity", label: "פעילות" },
];

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

      <SectionNav sections={PROJECT_SECTIONS} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div id="sec-brand" data-reveal className="scroll-mt-20">
            <BrandGuidelines brand={brand} colors={colors} />
          </div>
          <div id="sec-roadmap" data-reveal className="scroll-mt-20">
            <ProgressTimeline projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div id="sec-approvals" data-reveal className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("approval")} />
            <ApprovalsSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div id="sec-checklist" data-reveal className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("checklist")} />
            <ChecklistSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div id="sec-tasks" data-reveal className="scroll-mt-20">
            <TasksSection
              projectId={project.id}
              isAdmin={isAdmin}
              clientId={project.client_id}
              adminId={actorId}
            />
          </div>
          <div id="sec-files" data-reveal className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("file")} />
            <FileManager
              projectId={project.id}
              isAdmin={isAdmin}
              actorId={actorId}
              zipName={brand?.business_name || project.title}
            />
          </div>
          <div id="sec-docs" data-reveal className="scroll-mt-20">
            <DocsSection projectId={project.id} isAdmin={isAdmin} actorId={actorId} />
          </div>
          <div id="sec-payments" data-reveal className="scroll-mt-20">
            <PaymentsSection projectId={project.id} isAdmin={isAdmin} />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div id="sec-warranty" data-reveal className="scroll-mt-20">
            <WarrantyCountdown project={project} />
          </div>
          <div id="sec-chat" data-reveal className="scroll-mt-20">
            <SectionUpdated show={updatedSections.has("message")} />
            <InternalChat
              projectId={project.id}
              projectTitle={brand?.business_name || project.title}
              senderId={actorId}
              isAdmin={isAdmin}
            />
          </div>
          <div id="sec-activity" data-reveal className="scroll-mt-20">
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
