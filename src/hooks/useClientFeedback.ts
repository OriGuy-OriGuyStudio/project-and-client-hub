import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ClientFeedback } from "@/types/database";

/** The current client's own interface-feedback items (with admin replies). */
export function useMyFeedback() {
  return useQuery({
    queryKey: ["my-feedback"],
    queryFn: async (): Promise<ClientFeedback[]> => {
      const { data, error } = await supabase
        .from("client_feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** All feedback (admin view) with the submitter's name. */
export interface AdminFeedback extends ClientFeedback {
  client_name: string;
}
export function useAllFeedback() {
  return useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async (): Promise<AdminFeedback[]> => {
      const [{ data: fb, error }, { data: profiles }] = await Promise.all([
        supabase.from("client_feedback").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      if (error) throw error;
      const nameById = new Map(
        (profiles ?? []).map((p) => [p.id, p.full_name || p.email])
      );
      return (fb ?? []).map((f) => ({
        ...f,
        client_name: nameById.get(f.client_id) ?? "-",
      }));
    },
  });
}

export const feedbackStatusHe: Record<ClientFeedback["status"], string> = {
  open: "חדש",
  in_progress: "בטיפול",
  resolved: "טופל",
};
