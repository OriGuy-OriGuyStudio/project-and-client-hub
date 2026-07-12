import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { questionText } from "@/lib/discovery";
import type { ProjectDeliverable } from "@/types/database";

/** Admin: all tool deliverables for a project (persona/journey/sitemap). */
export function useProjectDeliverables(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["deliverables", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectDeliverable[]> => {
      const { data, error } = await supabase
        .from("project_deliverables")
        .select("*")
        .eq("project_id", projectId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectDeliverable[];
    },
  });
}

/** Published personas for a project, for the client-facing project page. RLS
 *  returns only published rows the caller can access (org membership). */
export function usePublishedPersonas(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["published-personas", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectDeliverable[]> => {
      const { data, error } = await supabase
        .from("project_deliverables")
        .select("*")
        .eq("project_id", projectId!)
        .eq("kind", "persona")
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectDeliverable[];
    },
  });
}

export interface DiscoveryForGen {
  title: string;
  items: { question: string; answer: string }[];
  found: boolean;
}

/** The latest discovery session's answers for a project, flattened to
 *  question/answer pairs for the AI generator. `found=false` if the project has
 *  no linked discovery session yet. */
export function useProjectDiscoveryItems(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["discovery-for-gen", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<DiscoveryForGen> => {
      // 1) a discovery session linked directly to this project.
      let { data, error } = await supabase
        .from("discovery_sessions")
        .select("title, template_key, answers")
        .eq("project_id", projectId!)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // 2) fallback: the latest discovery of the project's business (org), since
      //    calls are usually linked to the org, not one specific project.
      if (!data) {
        const { data: proj } = await supabase
          .from("projects")
          .select("org_id")
          .eq("id", projectId!)
          .maybeSingle();
        if (proj?.org_id) {
          const r = await supabase
            .from("discovery_sessions")
            .select("title, template_key, answers")
            .eq("org_id", proj.org_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          data = r.data;
        }
      }
      if (!data) return { title: "", items: [], found: false };
      const answers = (data.answers ?? {}) as Record<string, { value?: string }>;
      const items = Object.entries(answers)
        .map(([qid, a]) => ({
          question: questionText(data.template_key, qid),
          answer: (a?.value ?? "").trim(),
        }))
        .filter((i) => i.answer.length > 0);
      return { title: data.title, items, found: true };
    },
  });
}
