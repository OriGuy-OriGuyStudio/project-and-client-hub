import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Figma, Globe, Pencil, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarrantyBadge } from "@/components/warranty/WarrantyCountdown";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { projectStatusHe, projectStatusVariant } from "@/lib/status";
import type { ClientBrand, Project } from "@/types/database";

const links = [
  { key: "figma_url" as const, label: "עיצוב Figma", icon: Figma },
  { key: "staging_url" as const, label: "סביבת Staging", icon: Server },
  { key: "live_url" as const, label: "אתר Live", icon: Globe },
];

export function ProjectHero({
  project,
  brand,
  isAdmin,
}: {
  project: Project;
  brand: ClientBrand | null;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    figma_url: project.figma_url ?? "",
    staging_url: project.staging_url ?? "",
    live_url: project.live_url ?? "",
  });

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        figma_url: draft.figma_url || null,
        staging_url: draft.staging_url || null,
        live_url: draft.live_url || null,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      toastError("שמירת הקישורים נכשלה.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["project", project.id] });
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-brand-purple-base/30">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt="" className="size-full object-cover" />
            ) : (
              <Building2 className="size-6 text-brand-cyan-base" />
            )}
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {brand?.business_name || project.title}
            </h1>
            <p className="text-sm text-muted-foreground">{project.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WarrantyBadge project={project} />
          <Badge variant={projectStatusVariant[project.status]}>
            {projectStatusHe[project.status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            עודכן: {new Date(project.updated_at).toLocaleDateString("he-IL")}
          </span>
        </div>
      </div>

      {/* Quick links */}
      {editing ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {links.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
              <l.icon className="size-4 shrink-0 text-muted-foreground" />
              <Input
                dir="ltr"
                placeholder={l.label}
                value={draft[l.key]}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [l.key]: e.target.value }))
                }
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              ביטול
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "שומר…" : "שמירה"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((l) => {
            const url = project[l.key];
            if (!url) return null;
            return (
              <a
                key={l.key}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40"
              >
                <l.icon className="size-4 text-brand-cyan-base" />
                {l.label}
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            );
          })}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="text-muted-foreground"
            >
              <Pencil className="size-4" /> עריכת קישורים
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
