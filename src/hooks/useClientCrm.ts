import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AdminClientNote, ClientCallLog } from "@/types/database";

export interface ClientCrm {
  note: AdminClientNote | null;
  calls: ClientCallLog[];
}

/** Admin-private CRM info + call log for a client (active profiles only). */
export function useClientCrm(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["client-crm", clientId],
    queryFn: async (): Promise<ClientCrm> => {
      const [{ data: note }, { data: calls }] = await Promise.all([
        supabase.from("admin_client_notes").select("*").eq("client_id", clientId!).maybeSingle(),
        supabase
          .from("client_call_logs")
          .select("*")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false }),
      ]);
      return { note: note ?? null, calls: calls ?? [] };
    },
  });
}
