import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  AdminClientNote,
  ClientBrand,
  ClientCallLog,
  Profile,
  Project,
} from "@/types/database";

export interface ClientDetailData {
  profile: Profile | null;
  brand: ClientBrand | null;
  note: AdminClientNote | null;
  calls: ClientCallLog[];
  projects: Project[];
  referralCount: number;
  credits: number;
  enrolled: boolean;
}

/** Everything the admin needs to see about one client on their detail page. */
export function useClientDetail(clientId: string | undefined) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["client-detail", clientId],
    queryFn: async (): Promise<ClientDetailData> => {
      const id = clientId!;
      const [
        { data: profile },
        { data: brand },
        { data: note },
        { data: calls },
        { data: projects },
        { count: referralCount },
        { data: credits },
        { data: enrollment },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("client_brand").select("*").eq("client_id", id).maybeSingle(),
        supabase.from("admin_client_notes").select("*").eq("client_id", id).maybeSingle(),
        supabase.from("client_call_logs").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("projects").select("*").eq("client_id", id).order("updated_at", { ascending: false }),
        supabase.from("referrals").select("*", { count: "exact", head: true }).eq("referrer_id", id),
        supabase.rpc("get_client_credits", { p_client_id: id }),
        supabase.from("partner_enrollments").select("client_id").eq("client_id", id).maybeSingle(),
      ]);

      return {
        profile: profile ?? null,
        brand: brand ?? null,
        note: note ?? null,
        calls: calls ?? [],
        projects: projects ?? [],
        referralCount: referralCount ?? 0,
        credits: credits ?? 0,
        enrolled: !!enrollment,
      };
    },
  });
}
