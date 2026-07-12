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

/** Admin view of clients: active profiles + pending whitelist entries. Each
 * profile's "business_name" is its ORGANIZATION's brand (the single
 * `is_org_primary` client_brand row), not a row keyed on that profile's own
 * client_id - so every member of a business shows the same business name. */
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
      let businessNameByClient = new Map<string, string | null>();
      const enrolled = new Set<string>();
      if (profileList.length) {
        const ids = profileList.map((p) => p.id);
        const [{ data: memberships }, { data: enrollments }] = await Promise.all([
          supabase.from("organization_members").select("user_id, org_id").in("user_id", ids),
          supabase.from("partner_enrollments").select("client_id").in("client_id", ids),
        ]);
        (enrollments ?? []).forEach((e) => enrolled.add(e.client_id));

        const orgByUser = new Map((memberships ?? []).map((m) => [m.user_id, m.org_id]));
        const orgIds = [...new Set(orgByUser.values())];
        const brandByOrg = new Map<string, string | null>();
        if (orgIds.length) {
          const { data: brands } = await supabase
            .from("client_brand")
            .select("org_id, business_name")
            .eq("is_org_primary", true)
            .in("org_id", orgIds);
          for (const b of brands ?? []) {
            if (b.org_id) brandByOrg.set(b.org_id, b.business_name);
          }
        }
        businessNameByClient = new Map(
          profileList.map((p) => {
            const orgId = orgByUser.get(p.id);
            return [p.id, orgId ? brandByOrg.get(orgId) ?? null : null];
          })
        );
      }
      const active: ActiveClient[] = profileList.map((p) => ({
        ...p,
        business_name: businessNameByClient.get(p.id) ?? null,
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
