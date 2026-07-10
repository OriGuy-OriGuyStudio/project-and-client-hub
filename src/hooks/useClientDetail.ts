import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  AdminClientNote,
  BrandColor,
  ClientBrand,
  ClientCallLog,
  CoinGrant,
  Profile,
  Project,
  RewardRedemption,
  ServiceAgreement,
} from "@/types/database";

export type ClientRedemptionRow = RewardRedemption & {
  reward: { name: string } | null;
};

export interface ClientDetailData {
  profile: Profile | null;
  brand: ClientBrand | null;
  colors: BrandColor[];
  note: AdminClientNote | null;
  calls: ClientCallLog[];
  projects: Project[];
  referralCount: number;
  credits: number;
  enrolled: boolean;
  curious: boolean;
  grants: CoinGrant[];
  redemptions: ClientRedemptionRow[];
  agreements: ServiceAgreement[];
  invite: {
    invite_sent_at: string | null;
    invite_send_count: number;
    invite_last_status: "sent" | "failed" | null;
  } | null;
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
        { data: colors },
        { data: note },
        { data: calls },
        { data: projects },
        { count: referralCount },
        { data: credits },
        { data: enrollment },
        { data: curious },
        { data: grants },
        { data: redemptions },
        { data: agreements },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("client_brand").select("*").eq("client_id", id).maybeSingle(),
        supabase.from("brand_colors").select("*").eq("client_id", id).order("sort_order"),
        supabase.from("admin_client_notes").select("*").eq("client_id", id).maybeSingle(),
        supabase.from("client_call_logs").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("projects").select("*").eq("client_id", id).order("updated_at", { ascending: false }),
        supabase.from("referrals").select("*", { count: "exact", head: true }).eq("referrer_id", id),
        supabase.rpc("get_client_credits", { p_client_id: id }),
        supabase.from("partner_enrollments").select("client_id").eq("client_id", id).maybeSingle(),
        supabase.from("easter_egg_claims").select("client_id").eq("client_id", id).maybeSingle(),
        supabase.from("coin_grants").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase
          .from("reward_redemptions")
          .select("*, reward:rewards(name)")
          .eq("client_id", id)
          .order("redeemed_at", { ascending: false }),
        supabase
          .from("service_agreements")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]);

      // Welcome-invite status lives on the whitelist row (keyed by email).
      let invite: ClientDetailData["invite"] = null;
      if (profile?.email) {
        const { data: ae } = await supabase
          .from("allowed_emails")
          .select("invite_sent_at, invite_send_count, invite_last_status")
          .ilike("email", profile.email)
          .maybeSingle();
        invite = ae ?? null;
      }

      return {
        profile: profile ?? null,
        brand: brand ?? null,
        colors: colors ?? [],
        note: note ?? null,
        calls: calls ?? [],
        projects: projects ?? [],
        referralCount: referralCount ?? 0,
        credits: credits ?? 0,
        enrolled: !!enrollment,
        curious: !!curious,
        grants: grants ?? [],
        redemptions: (redemptions as unknown as ClientRedemptionRow[] | null) ?? [],
        agreements: (agreements as ServiceAgreement[] | null) ?? [],
        invite,
      };
    },
  });
}
