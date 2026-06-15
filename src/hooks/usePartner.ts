import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  PartnerLead,
  PartnerProfile,
  Reward,
  PartnerRewardRedemption,
  PartnerCoinTransaction,
} from "@/types/database";

export interface PartnerData {
  profile: PartnerProfile | null;
  leads: PartnerLead[];
  clicks: number;
  conversions: number;
  coins: number;
  rewards: Reward[];
  redemptions: PartnerRewardRedemption[];
  coinLedger: PartnerCoinTransaction[];
}

/** The signed-in partner's profile, leads, referral stats, coins and store. */
export function usePartner() {
  return useQuery({
    queryKey: ["partner-me"],
    queryFn: async (): Promise<PartnerData> => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      const [
        { data: profile },
        { data: leads },
        { count: clicks },
        { count: conversions },
        { data: coins },
        { data: rewards },
        { data: redemptions },
        { data: coinLedger },
      ] = await Promise.all([
        supabase.from("partner_profiles").select("*").eq("id", uid!).maybeSingle(),
        supabase.from("partner_leads").select("*").order("created_at", { ascending: false }),
        supabase.from("referral_tracking").select("*", { count: "exact", head: true }),
        supabase
          .from("referral_tracking")
          .select("*", { count: "exact", head: true })
          .not("converted_to_lead_id", "is", null),
        supabase.rpc("get_partner_coins", { p_partner: uid! }),
        supabase
          .from("rewards")
          .select("*")
          .eq("is_active", true)
          .eq("audience", "partner")
          .order("credit_cost"),
        supabase
          .from("partner_reward_redemptions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("partner_coin_transactions")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      return {
        profile: profile ?? null,
        leads: leads ?? [],
        clicks: clicks ?? 0,
        conversions: conversions ?? 0,
        coins: (coins as number | null) ?? 0,
        rewards: rewards ?? [],
        redemptions: redemptions ?? [],
        coinLedger: coinLedger ?? [],
      };
    },
  });
}
