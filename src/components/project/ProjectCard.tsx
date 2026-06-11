import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.08 }}
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
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-brand-purple-base/30">
                {project.logo_url ? (
                  <img
                    src={project.logo_url}
                    alt=""
                    className="size-full object-cover"
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
            <Badge variant={projectStatusVariant[project.status]}>
              {projectStatusHe[project.status]}
            </Badge>
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
