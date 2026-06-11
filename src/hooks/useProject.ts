import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BrandColor, ClientBrand, Project } from "@/types/database";

export interface ProjectBundle {
  project: Project;
  brand: ClientBrand | null;
  colors: BrandColor[];
}

/** A single project plus the owning client's brand identity + palette. */
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

      const [{ data: brand }, { data: colors }] = await Promise.all([
        supabase
          .from("client_brand")
          .select("*")
          .eq("client_id", project.client_id)
          .maybeSingle(),
        supabase
          .from("brand_colors")
          .select("*")
          .eq("client_id", project.client_id)
          .order("sort_order", { ascending: true }),
      ]);

      return { project, brand: brand ?? null, colors: colors ?? [] };
    },
  });
}
