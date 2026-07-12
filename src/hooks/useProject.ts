import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchOrgBrand } from "@/hooks/useClientBrand";
import type { BrandColor, ClientBrand, Project } from "@/types/database";

export interface ProjectBundle {
  project: Project;
  brand: ClientBrand | null;
  colors: BrandColor[];
}

/**
 * A single project plus its BUSINESS's brand identity + palette, resolved by
 * the project's `org_id` (not by whichever member is the project's
 * responsible contact) - so the same project always shows the same brand no
 * matter who's viewing it. Projects created before the org backfill (rare)
 * have a null org_id and degrade to no brand rather than crashing.
 */
export function useProject(projectId: string | undefined) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["project", projectId],
    queryFn: async (): Promise<ProjectBundle> => {
      const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;

      const { brand, colors } = project.org_id
        ? await fetchOrgBrand(project.org_id)
        : { brand: null, colors: [] };

      return { project, brand, colors };
    },
  });
}
