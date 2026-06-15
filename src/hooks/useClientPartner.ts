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
      ] = await Promise.all([
        supabase.rpc("get_client_credits", { p_client_id: uid! }),
        supabase.from("partner_enrollments").select("*").eq("client_id", uid!).maybeSingle(),
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("rewards").select("*").eq("is_active", true).eq("audience", "client").order("credit_cost"),
        supabase.from("reward_redemptions").select("*").order("redeemed_at", { ascending: false }),
        supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }),
      ]);

      return {
        credits: credits ?? 0,
        enrollment: enrollment ?? null,
        referrals: referrals ?? [],
        rewards: rewards ?? [],
        redemptions: redemptions ?? [],
        ledger: ledger ?? [],
      };
    },
  });
}
