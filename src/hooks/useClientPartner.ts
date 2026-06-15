import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  CreditTransaction,
  PartnerEnrollment,
  Referral,
  Reward,
  RewardRedemption,
} from "@/types/database";

export interface ClientPartnerData {
  credits: number;
  enrollment: PartnerEnrollment | null;
  referrals: Referral[];
  rewards: Reward[];
  redemptions: RewardRedemption[];
  ledger: CreditTransaction[];
  ilsPerCoin: number;
  giftValuePct: number;
}

/** Everything the client needs for the referral / rewards program. */
export function useClientPartner() {
  return useQuery({
    queryKey: ["client-partner"],
    queryFn: async (): Promise<ClientPartnerData> => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      const [
        { data: credits },
        { data: enrollment },
        { data: referrals },
        { data: rewards },
        { data: redemptions },
        { data: ledger },
        { data: stockUsed },
        { data: settings },
      ] = await Promise.all([
        supabase.rpc("get_client_credits", { p_client_id: uid! }),
        supabase.from("partner_enrollments").select("*").eq("client_id", uid!).maybeSingle(),
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        supabase
          .from("rewards")
          .select("*")
          .eq("is_active", true)
          .in("audience", ["client", "both"])
          .order("sort_order")
          .order("credit_cost"),
        supabase.from("reward_redemptions").select("*").order("redeemed_at", { ascending: false }),
        supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }),
        supabase.rpc("rewards_stock_used", { p_audience: "client" }),
        supabase.from("studio_settings").select("ils_per_coin, gift_value_pct").maybeSingle(),
      ]);

      const usedById = new Map(
        ((stockUsed as { reward_id: string; used: number }[] | null) ?? []).map((s) => [
          s.reward_id,
          s.used,
        ])
      );

      return {
        credits: credits ?? 0,
        enrollment: enrollment ?? null,
        referrals: referrals ?? [],
        rewards: (rewards ?? []).map((r) => ({
          ...r,
          stock_left: r.stock == null ? null : Math.max(0, r.stock - (usedById.get(r.id) ?? 0)),
        })),
        redemptions: redemptions ?? [],
        ledger: ledger ?? [],
        ilsPerCoin: settings?.ils_per_coin ?? 1,
        giftValuePct: settings?.gift_value_pct ?? 75,
      };
    },
  });
}
