import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DevFeedback } from "@/types/database";

/** Dev-feedback comments for a project. RLS scopes clients to their own project. */
export function useDevFeedback(projectId: string) {
  return useQuery({
    queryKey: ["dev-feedback", projectId],
    queryFn: async (): Promise<DevFeedback[]> => {
      const { data, error } = await supabase
        .from("dev_feedback")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
