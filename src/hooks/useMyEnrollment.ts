import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Whether the current client has been approved into the referral program. */
export function useMyEnrollment(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["my-enrollment"],
    queryFn: async (): Promise<boolean> => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return false;
      const { data } = await supabase
        .from("partner_enrollments")
        .select("client_id")
        .eq("client_id", uid)
        .maybeSingle();
      return !!data;
    },
  });
}
