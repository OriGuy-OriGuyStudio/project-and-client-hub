import { Link, useParams } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { useAuth } from "@/hooks/useAuth";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { GuideSection } from "@/components/project/GuideSection";

/**
 * Dedicated full-screen "site usage guide" for a project, reached from the
 * entry card on the project page. Keeps the guide off the already-dense
 * project page and gives the client a focused place to read all the how-tos.
 */
export default function ProjectGuide() {
  const { id } = useParams();
  const { isAdmin, user } = useAuth();
  const { data, isLoading, isError } = useProject(id);

  if (isLoading) return <CenteredLoader />;
  if (isError || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="הפרויקט לא נמצא"
        description="ייתכן שאין לך גישה אליו."
      />
    );
  }

  const { project } = data;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Link
        to={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        חזרה לפרויקט
        <span className="text-foreground">{project.title}</span>
      </Link>

      <GuideSection projectId={project.id} isAdmin={isAdmin} actorId={user?.id ?? null} />
    </div>
  );
}
