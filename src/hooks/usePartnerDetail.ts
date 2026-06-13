import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PartnerLead, PartnerProfile, Profile } from "@/types/database";

export interface PartnerDetailData {
  profile: Profile | null;
  partner: PartnerProfile | null;
  leads: PartnerLead[];
  totalLeads: number;
  closedDeals: number;
  paidCommission: number; // sum of commission_amount where payment confirmed
}

/** Everything the admin needs on one partner's detail page. */
export function usePartnerDetail(partnerId: string | undefined) {
  return useQuery({
    enabled: !!partnerId,
    queryKey: ["partner-detail", partnerId],
    queryFn: async (): Promise<PartnerDetailData> => {
      const id = partnerId!;
      const [{ data: profile }, { data: partner }, { data: leads }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("partner_profiles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("partner_leads")
          .select("*")
          .eq("partner_id", id)
          .order("created_at", { ascending: false }),
      ]);

      const rows = leads ?? [];
      const paidCommission = rows
        .filter((l) => l.payment_confirmed_at)
        .reduce((sum, l) => sum + (l.commission_amount ?? 0), 0);

      return {
        profile: profile ?? null,
        partner: partner ?? null,
        leads: rows,
        totalLeads: rows.length,
        closedDeals: rows.filter((l) => l.status === "closed").length,
        paidCommission,
      };
    },
  });
}
