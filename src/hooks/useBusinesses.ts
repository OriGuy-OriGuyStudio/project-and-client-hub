import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BusinessRow } from "@/types/database";

/** Admin: one aggregated row per organization (members/projects/last activity),
 * split by kind (real/demo/studio) for the Businesses list page. */
export function useBusinesses() {
  return useQuery({
    queryKey: ["admin-businesses"],
    queryFn: async (): Promise<BusinessRow[]> => {
      const { data, error } = await supabase.rpc("admin_businesses");
      if (error) throw error;
      return (data ?? []) as BusinessRow[];
    },
  });
}
