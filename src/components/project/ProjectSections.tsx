import { FolderKanban, Building2, FlaskConical } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import type { ProjectWithBrand } from "@/hooks/useProjects";

/** Renders projects grouped into clients / demo / studio sections. */
export function ProjectSections({
  groups,
  unread,
}: {
  groups: { client: ProjectWithBrand[]; demo: ProjectWithBrand[]; studio: ProjectWithBrand[] };
  unread: Set<string>;
}) {
  const { client, demo, studio } = groups;
  const grid = (list: ProjectWithBrand[], offset: number) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p, i) => (
        <ProjectCard key={p.id} project={p} index={offset + i} isNew={unread.has(p.id)} />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <FolderKanban className="size-5 text-brand-cyan-base" /> פרויקטים של לקוחות
          <span className="text-sm font-normal text-muted-foreground">({client.length})</span>
        </h2>
        {client.length ? grid(client, 0) : <p className="text-sm text-muted-foreground">אין עדיין פרויקטים ללקוחות.</p>}
      </section>

      {demo.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <FlaskConical className="size-5 text-amber-500" /> פרויקטים לדוגמה (דמה)
            <span className="text-sm font-normal text-muted-foreground">({demo.length})</span>
          </h2>
          {grid(demo, client.length)}
        </section>
      )}

      {studio.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Building2 className="size-5 text-primary" /> פרויקטים של הסטודיו
            <span className="text-sm font-normal text-muted-foreground">({studio.length}) · פנימי</span>
          </h2>
          {grid(studio, client.length + demo.length)}
        </section>
      )}
    </div>
  );
}
