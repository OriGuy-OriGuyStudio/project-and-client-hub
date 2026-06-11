import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PartnerLead, PartnerProfile } from "@/types/database";

export interface PartnerData {
  profile: PartnerProfile | null;
  leads: PartnerLead[];
  clicks: number;
  conversions: number;
}

/** The signed-in partner's own profile, leads and referral-link stats. */
export function usePartner() {
  return useQuery({
    queryKey: ["partner-me"],
    queryFn: async (): Promise<PartnerData> => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      const [{ data: profile }, { data: leads }, { count: clicks }, { count: conversions }] =
        await Promise.all([
          supabase.from("partner_profiles").select("*").eq("id", uid!).maybeSingle(),
          supabase
            .from("partner_leads")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("referral_tracking")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("referral_tracking")
            .select("*", { count: "exact", head: true })
            .not("converted_to_lead_id", "is", null),
        ]);

      return {
        profile: profile ?? null,
        leads: leads ?? [],
        clicks: clicks ?? 0,
        conversions: conversions ?? 0,
      };
    },
  });
}
