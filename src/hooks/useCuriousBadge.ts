import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** True once the client has discovered the warp easter egg (the "curious" badge). */
export function useCuriousBadge() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["curious-badge", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("easter_egg_claims")
        .select("client_id")
        .eq("client_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });
}
