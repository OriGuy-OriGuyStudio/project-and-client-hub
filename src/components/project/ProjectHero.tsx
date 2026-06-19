import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Figma, Globe, Monitor, Pencil, Server, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarrantyBadge } from "@/components/warranty/WarrantyCountdown";
import { MeshBanner } from "@/components/ui/mesh-banner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { projectStatusHe, projectStatusVariant } from "@/lib/status";
import type { BrandColor, ClientBrand, Project } from "@/types/database";

const links = [
  { key: "figma_url" as const, label: "עיצוב Figma", icon: Figma },
  { key: "figma_prototype_mobile_url" as const, label: "אבטיפוס מובייל", icon: Smartphone },
  { key: "figma_prototype_desktop_url" as const, label: "אבטיפוס דסקטופ", icon: Monitor },
  { key: "staging_url" as const, label: "סביבת Staging", icon: Server },
  { key: "live_url" as const, label: "אתר Live", icon: Globe },
];

// Brand-themed mesh (dark base → brand cyan/greens) when the client has no palette.
const DEFAULT_MESH = ["#16151c", "#1d9e75", "#77becf", "#B4D670", "#91be37"];

function meshColors(colors: BrandColor[]): string[] {
  const hex = colors.map((c) => c.hex_value).filter(Boolean);
  return hex.length >= 2 ? hex : DEFAULT_MESH;
}

export function ProjectHero({
  project,
  brand,
  colors = [],
  isAdmin,
}: {
  project: Project;
  brand: ClientBrand | null;
  colors?: BrandColor[];
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    figma_url: project.figma_url ?? "",
    figma_prototype_mobile_url: project.figma_prototype_mobile_url ?? "",
    figma_prototype_desktop_url: project.figma_prototype_desktop_url ?? "",
    staging_url: project.staging_url ?? "",
    live_url: project.live_url ?? "",
  });

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        figma_url: draft.figma_url || null,
        figma_prototype_mobile_url: draft.figma_prototype_mobile_url || null,
        figma_prototype_desktop_url: draft.figma_prototype_desktop_url || null,
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Banner — an animated mesh gradient drawn from the client's brand palette. */}
      <MeshBanner colors={meshColors(colors)} className="h-[clamp(120px,22vh,200px)] w-full" />

      {/* Sits above the banner's WebGL canvas (positioned), so the logo isn't clipped. */}
      <div className="relative z-10 px-5 pb-5">
        {/* Logo circle straddles the banner edge (half in, half out); the name sits
            on the card beside its lower half. */}
        <div className="flex items-end gap-4">
          <span
            className={cn(
              "-mt-14 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 bg-card shadow-lift",
              brand?.logo_url ? "border-white" : "border-card"
            )}
          >
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt="" className="size-full object-cover" />
            ) : (
              <Building2 className="size-9 text-brand-cyan-base" />
            )}
          </span>

          <div className="min-w-0 pb-0.5">
            <h1 className="truncate font-heading text-xl font-bold text-foreground sm:text-2xl">
              {brand?.business_name || project.title}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{project.title}</p>
          </div>
        </div>

        {/* Status row — on the card, below the name. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <WarrantyBadge project={project} />
          <Badge variant={projectStatusVariant[project.status]}>
            {projectStatusHe[project.status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            עודכן: {new Date(project.updated_at).toLocaleDateString("he-IL")}
          </span>
        </div>

        {/* Quick links */}
        <div className="mt-4">
          {editing ? (
            <div className="space-y-2 rounded-xl border border-border bg-background/40 p-4">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40"
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
      </div>
    </div>
  );
}
