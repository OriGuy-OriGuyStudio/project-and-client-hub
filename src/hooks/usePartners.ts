import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AllowedEmail, PartnerProfile, Profile } from "@/types/database";

export interface ActivePartner extends Profile {
  commission_rate: number | null;
  commission_rate_min: number | null;
  commission_rate_max: number | null;
  referral_code: string | null;
}

/** "5%" for a fixed rate, "5%–7.5%" for a range. */
export function rateLabel(
  rate: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (min != null && max != null && min !== max) return `${min}%–${max}%`;
  return rate != null ? `${rate}%` : "-";
}

export interface PartnersData {
  active: ActivePartner[];
  pending: AllowedEmail[];
}

/** Admin view of partners: active profiles (+ partner_profile) + pending invites. */
export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: async (): Promise<PartnersData> => {
      const [{ data: profiles }, { data: pp }, { data: allowed }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "partner"),
        supabase.from("partner_profiles").select("*"),
        supabase.from("allowed_emails").select("*").eq("role", "partner"),
      ]);

      const ppById = new Map<string, PartnerProfile>(
        (pp ?? []).map((p) => [p.id, p])
      );
      const active: ActivePartner[] = (profiles ?? []).map((p) => ({
        ...p,
        commission_rate: ppById.get(p.id)?.commission_rate ?? null,
        commission_rate_min: ppById.get(p.id)?.commission_rate_min ?? null,
        commission_rate_max: ppById.get(p.id)?.commission_rate_max ?? null,
        referral_code: ppById.get(p.id)?.referral_code ?? null,
      }));

      const activeEmails = new Set(active.map((p) => p.email.toLowerCase()));
      const pending = (allowed ?? []).filter(
        (a) => !activeEmails.has(a.email.toLowerCase())
      );

      return { active, pending };
    },
  });
}
