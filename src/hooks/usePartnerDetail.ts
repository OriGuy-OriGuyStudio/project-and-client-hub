import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  CoinGrant,
  PartnerLead,
  PartnerProfile,
  PartnerRewardRedemption,
  Profile,
} from "@/types/database";

export type PartnerRedemptionRow = PartnerRewardRedemption & {
  reward: { name: string; kind: string } | null;
};

export interface PartnerDetailData {
  profile: Profile | null;
  partner: PartnerProfile | null;
  leads: PartnerLead[];
  totalLeads: number;
  closedDeals: number;
  paidCommission: number; // sum of commission_amount where payment confirmed
  coins: number;
  redemptions: PartnerRedemptionRow[];
  grants: CoinGrant[];
}

/** Everything the admin needs on one partner's detail page. */
export function usePartnerDetail(partnerId: string | undefined) {
  return useQuery({
    enabled: !!partnerId,
    queryKey: ["partner-detail", partnerId],
    queryFn: async (): Promise<PartnerDetailData> => {
      const id = partnerId!;
      const [
        { data: profile },
        { data: partner },
        { data: leads },
        { data: coins },
        { data: redemptions },
        { data: grants },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("partner_profiles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("partner_leads")
          .select("*")
          .eq("partner_id", id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_partner_coins", { p_partner: id }),
        supabase
          .from("partner_reward_redemptions")
          .select("*, reward:rewards(name,kind)")
          .eq("partner_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("coin_grants").select("*").eq("user_id", id).order("created_at", { ascending: false }),
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
        coins: (coins as number | null) ?? 0,
        redemptions: (redemptions as unknown as PartnerRedemptionRow[] | null) ?? [],
        grants: grants ?? [],
      };
    },
  });
}
