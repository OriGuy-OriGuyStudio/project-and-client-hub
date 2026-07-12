import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LogoFit, Project } from "@/types/database";

export interface ProjectWithBrand extends Project {
  business_name: string | null;
  logo_url: string | null;
  logo_fit: LogoFit;
  /** Active maintenance package tier for this project, if any (marks it "special"). */
  service_tier?: string | null;
}

/**
 * Projects visible to the current user. RLS scopes the rows automatically:
 * clients see only their own (+ any org they're a member of), admins see all.
 * Business name/logo come from each project's BUSINESS - i.e. the org's
 * single primary client_brand row (fetched separately to avoid brittle
 * embeds), not from the project's responsible-contact client_id. Projects
 * with no org_id yet (rare) simply show no brand.
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

      const orgIds = [...new Set(projects.map((p) => p.org_id).filter((id): id is string => !!id))];
      const brandByOrg = new Map<string, { business_name: string | null; logo_url: string | null; logo_fit: LogoFit }>();
      if (orgIds.length) {
        const { data: brands } = await supabase
          .from("client_brand")
          .select("org_id, business_name, logo_url, logo_fit")
          .eq("is_org_primary", true)
          .in("org_id", orgIds);
        for (const b of brands ?? []) {
          if (b.org_id) brandByOrg.set(b.org_id, b);
        }
      }

      // Active maintenance packages, to mark those projects as "special".
      const { data: services } = await supabase
        .from("project_service")
        .select("project_id, tier, active")
        .in("project_id", projects.map((p) => p.id))
        .eq("active", true);
      const tierByProject = new Map((services ?? []).map((s) => [s.project_id, s.tier]));

      return projects.map((p) => {
        const brand = p.org_id ? brandByOrg.get(p.org_id) : undefined;
        return {
          ...p,
          business_name: brand?.business_name ?? null,
          logo_url: brand?.logo_url ?? null,
          logo_fit: brand?.logo_fit ?? "auto",
          service_tier: tierByProject.get(p.id) ?? null,
        };
      });
    },
  });
}
