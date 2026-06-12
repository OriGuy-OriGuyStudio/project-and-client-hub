import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PartnerLead } from "@/types/database";

export interface AdminLead extends PartnerLead {
  partner_name: string;
  partner_email: string;
  partner_commission_rate: number | null;
  partner_rate_min: number | null;
  partner_rate_max: number | null;
}

/** Admin view of every partner lead, enriched with the partner's name + rate. */
export function useAllPartnerLeads() {
  return useQuery({
    queryKey: ["admin-partner-leads"],
    queryFn: async (): Promise<AdminLead[]> => {
      const [{ data: leads, error }, { data: profiles }, { data: pp }] =
        await Promise.all([
          supabase
            .from("partner_leads")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("id, full_name, email").eq("role", "partner"),
          supabase
            .from("partner_profiles")
            .select("id, commission_rate, commission_rate_min, commission_rate_max"),
        ]);
      if (error) throw error;

      const nameById = new Map(
        (profiles ?? []).map((p) => [p.id, { name: p.full_name, email: p.email }])
      );
      const rateById = new Map((pp ?? []).map((p) => [p.id, p]));

      return (leads ?? []).map((l) => ({
        ...l,
        partner_name: nameById.get(l.partner_id)?.name ?? "-",
        partner_email: nameById.get(l.partner_id)?.email ?? "",
        partner_commission_rate: rateById.get(l.partner_id)?.commission_rate ?? null,
        partner_rate_min: rateById.get(l.partner_id)?.commission_rate_min ?? null,
        partner_rate_max: rateById.get(l.partner_id)?.commission_rate_max ?? null,
      }));
    },
  });
}
