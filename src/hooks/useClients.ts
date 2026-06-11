import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AllowedEmail, Profile } from "@/types/database";

export interface ActiveClient extends Profile {
  business_name: string | null;
  enrolled: boolean; // approved into the referral program
}

export interface ClientsData {
  /** Clients who have signed in at least once (have a profile). */
  active: ActiveClient[];
  /** Pre-approved emails that haven't signed in yet (no profile). */
  pending: AllowedEmail[];
}

/** Admin view of clients: active profiles + pending whitelist entries. */
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<ClientsData> => {
      const [{ data: profiles, error: pErr }, { data: allowed, error: aErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("role", "client")
            .order("created_at", { ascending: false }),
          supabase
            .from("allowed_emails")
            .select("*")
            .eq("role", "client")
            .order("invited_at", { ascending: false }),
        ]);
      if (pErr) throw pErr;
      if (aErr) throw aErr;

      const profileList = profiles ?? [];
      let brandByClient = new Map<string, string | null>();
      const enrolled = new Set<string>();
      if (profileList.length) {
        const ids = profileList.map((p) => p.id);
        const [{ data: brands }, { data: enrollments }] = await Promise.all([
          supabase.from("client_brand").select("client_id, business_name").in("client_id", ids),
          supabase.from("partner_enrollments").select("client_id").in("client_id", ids),
        ]);
        brandByClient = new Map((brands ?? []).map((b) => [b.client_id, b.business_name]));
        (enrollments ?? []).forEach((e) => enrolled.add(e.client_id));
      }
      const active: ActiveClient[] = profileList.map((p) => ({
        ...p,
        business_name: brandByClient.get(p.id) ?? null,
        enrolled: enrolled.has(p.id),
      }));

      const activeEmails = new Set(profileList.map((p) => p.email.toLowerCase()));
      const pending = (allowed ?? []).filter(
        (a) => !activeEmails.has(a.email.toLowerCase())
      );

      return { active, pending };
    },
  });
}
