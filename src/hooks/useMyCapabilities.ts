import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Capabilities = {
  finance: boolean;
  service_calls: boolean;
  approve: boolean;
  files: boolean;
};

const NONE: Capabilities = { finance: false, service_calls: false, approve: false, files: false };

/**
 * The current user's capabilities on a project's organization. Admin -> all true
 * (server-side). Disabled (all false) when projectId is null, e.g. a public
 * preview with no authenticated member. The RPC call is shared (TanStack cache)
 * across every component that asks for the same project.
 */
export function useMyCapabilities(projectId: string | null | undefined) {
  const q = useQuery({
    queryKey: ["my-capabilities", projectId],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Capabilities> => {
      const { data, error } = await supabase.rpc("my_capabilities", { p_project: projectId! });
      if (error) throw error;
      return (data?.[0] as Capabilities) ?? NONE;
    },
  });
  return { ...(q.data ?? NONE), isLoading: q.isLoading && !!projectId };
}
