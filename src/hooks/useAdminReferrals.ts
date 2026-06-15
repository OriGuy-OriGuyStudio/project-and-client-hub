import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Referral, Reward } from "@/types/database";

export interface AdminReferral extends Referral {
  referrer_name: string;
}

export interface AdminReferralsData {
  referrals: AdminReferral[];
  rewards: Reward[];
  /** ILS per coin — drives the store's ₪→coins calculator. */
  ilsPerCoin: number;
  /** Percent of full coin value shown for monetary rewards. */
  giftValuePct: number;
}

export function useAdminReferrals() {
  return useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async (): Promise<AdminReferralsData> => {
      const [{ data: refs, error }, { data: profiles }, { data: rewards }, { data: settings }] =
        await Promise.all([
          supabase.from("referrals").select("*").order("created_at", { ascending: false }),
          supabase.from("profiles").select("id, full_name, email"),
          supabase.from("rewards").select("*").order("sort_order").order("credit_cost"),
          supabase.from("studio_settings").select("ils_per_coin, gift_value_pct").maybeSingle(),
        ]);
      if (error) throw error;

      const nameById = new Map(
        (profiles ?? []).map((p) => [p.id, p.full_name || p.email])
      );
      return {
        referrals: (refs ?? []).map((r) => ({
          ...r,
          referrer_name: nameById.get(r.referrer_id) ?? "-",
        })),
        rewards: rewards ?? [],
        ilsPerCoin: settings?.ils_per_coin ?? 1,
        giftValuePct: settings?.gift_value_pct ?? 75,
      };
    },
  });
}
