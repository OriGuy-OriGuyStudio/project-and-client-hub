import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";
import { projectStatusHe, projectStatusVariant } from "@/lib/status";
import type { ProjectWithBrand } from "@/hooks/useProjects";

export function ProjectCard({
  project,
  index = 0,
  isNew = false,
}: {
  project: ProjectWithBrand;
  index?: number;
  isNew?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.07 }}
    >
      <Link to={`/projects/${project.id}`} className="block">
        <Card
          className={
            "group relative h-full p-5 transition-colors hover:border-primary/40" +
            (isNew ? " border-primary/50 ring-1 ring-primary/30" : "")
          }
        >
          {isNew && (
            <span className="absolute -end-1.5 -top-1.5 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground shadow">
              עדכון חדש
            </span>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-purple-base/30">
                {project.logo_url ? (
                  <BrandLogo
                    src={project.logo_url}
                    fit={project.logo_fit}
                    className="size-full"
                  />
                ) : (
                  <Building2 className="size-5 text-brand-cyan-base" />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-heading text-base font-semibold text-foreground">
                  {project.business_name || project.title}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {project.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={projectStatusVariant[project.status]}>
                {projectStatusHe[project.status]}
              </Badge>
              {project.parent_project_id && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    project.retainer_billed
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-background/40 text-muted-foreground",
                  )}
                >
                  <Link2 className="size-2.5" /> {project.retainer_billed ? "מקושר לריטיינר" : "מקושר (עצמאי)"}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              עודכן:{" "}
              {new Date(project.updated_at).toLocaleDateString("he-IL")}
            </span>
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
