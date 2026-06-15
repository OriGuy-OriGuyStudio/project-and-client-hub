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
  ilsPerCoin: number;
  giftValuePct: number;
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
        { data: stockUsed },
        { data: settings },
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
          .in("audience", ["partner", "both"])
          .order("sort_order")
          .order("credit_cost"),
        supabase
          .from("partner_reward_redemptions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("partner_coin_transactions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.rpc("rewards_stock_used", { p_audience: "partner" }),
        supabase.from("studio_settings").select("ils_per_coin, gift_value_pct").maybeSingle(),
      ]);

      const usedById = new Map(
        ((stockUsed as { reward_id: string; used: number }[] | null) ?? []).map((s) => [
          s.reward_id,
          s.used,
        ])
      );

      return {
        profile: profile ?? null,
        leads: leads ?? [],
        clicks: clicks ?? 0,
        conversions: conversions ?? 0,
        coins: (coins as number | null) ?? 0,
        rewards: (rewards ?? []).map((r) => ({
          ...r,
          stock_left: r.stock == null ? null : Math.max(0, r.stock - (usedById.get(r.id) ?? 0)),
        })),
        redemptions: redemptions ?? [],
        coinLedger: coinLedger ?? [],
        ilsPerCoin: (settings?.ils_per_coin as number | undefined) ?? 1,
        giftValuePct: (settings?.gift_value_pct as number | undefined) ?? 75,
      };
    },
  });
}
