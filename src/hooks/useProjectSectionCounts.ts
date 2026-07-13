import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Row counts for the admin-populated ("passive") project sections, so the
 *  project page can hide them from the client when empty and collapse them for
 *  the admin. Counts run under the caller's RLS, so a client only counts what
 *  they can see. */
export interface ProjectSectionCounts {
  stages: number;
  approvals: number;
  checklist: number;
  payments: number;
}

async function countRows(table: string, projectId: string): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

export function useProjectSectionCounts(projectId: string | undefined) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["project-section-counts", projectId],
    queryFn: async (): Promise<ProjectSectionCounts> => {
      const id = projectId!;
      const [stages, approvals, checklist, payments] = await Promise.all([
        countRows("project_stages", id),
        countRows("approvals", id),
        countRows("checklist_items", id),
        countRows("payments", id),
      ]);
      return { stages, approvals, checklist, payments };
    },
  });
}
