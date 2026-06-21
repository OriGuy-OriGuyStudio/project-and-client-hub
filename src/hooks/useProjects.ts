import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LogoFit, Project } from "@/types/database";

export interface ProjectWithBrand extends Project {
  business_name: string | null;
  logo_url: string | null;
  logo_fit: LogoFit;
}

/**
 * Projects visible to the current user. RLS scopes the rows automatically:
 * clients see only their own, admins see all. Business name/logo come from
 * the matching client_brand row (fetched separately to avoid brittle embeds).
 */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectWithBrand[]> => {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (!projects?.length) return [];

      const clientIds = [...new Set(projects.map((p) => p.client_id))];
      const { data: brands } = await supabase
        .from("client_brand")
        .select("client_id, business_name, logo_url, logo_fit")
        .in("client_id", clientIds);

      const brandByClient = new Map(
        (brands ?? []).map((b) => [b.client_id, b])
      );

      return projects.map((p) => ({
        ...p,
        business_name: brandByClient.get(p.client_id)?.business_name ?? null,
        logo_url: brandByClient.get(p.client_id)?.logo_url ?? null,
        logo_fit: (brandByClient.get(p.client_id)?.logo_fit as LogoFit) ?? "auto",
      }));
    },
  });
}
