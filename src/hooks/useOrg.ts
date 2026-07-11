import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MemberInviteRequest, OrgMemberRow } from "@/types/database";
import type { CapValues } from "@/components/org/capabilityFields";

/** The organization a client's brand/account belongs to (admin reads via
 * client_brand). null when the client has no org yet (rare - pre-onboarding). */
export function useClientOrgId(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-org", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("client_brand")
        .select("org_id")
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data?.org_id ?? null;
    },
  });
}

/** Admin: a specific org's members + pending invites (for the client card). */
export function useAdminOrgMembers(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin-org-members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgMemberRow[]> => {
      const { data, error } = await supabase.rpc("admin_org_members", { p_org: orgId! });
      if (error) throw error;
      return (data ?? []) as OrgMemberRow[];
    },
  });
}

/** The current user's own org's members + pending invites. Empty array means
 * the caller isn't a manager of any org (not an error - just nothing to show). */
export function useMyOrgMembers() {
  return useQuery({
    queryKey: ["my-org-members"],
    queryFn: async (): Promise<OrgMemberRow[]> => {
      const { data, error } = await supabase.rpc("my_org_members");
      if (error) throw error;
      return (data ?? []) as OrgMemberRow[];
    },
  });
}

/** Admin inbox: pending member-invite requests from managers, newest first. */
export function usePendingMemberInvites() {
  return useQuery({
    queryKey: ["member-invite-requests"],
    queryFn: async (): Promise<MemberInviteRequest[]> => {
      const { data, error } = await supabase
        .from("member_invite_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---- mutations (plain async fns; callers invalidate the relevant query keys) ----

/** Admin: add/update a member on an org. If the email has no profile yet, it's
 * whitelisted + queued as a pending membership (materializes on first login). */
export async function addOrgMember(params: {
  orgId: string;
  email: string;
  fullName?: string | null;
  caps: CapValues;
}) {
  return supabase.rpc("admin_add_org_member", {
    p_org: params.orgId,
    p_email: params.email,
    p_full_name: params.fullName ?? null,
    p_is_manager: params.caps.isManager,
    p_finance: params.caps.finance,
    p_service_calls: params.caps.serviceCalls,
    p_approve: params.caps.approve,
    p_files: params.caps.files,
  });
}

/** Admin: overwrite an existing member's manager flag + capabilities. */
export async function setMemberCaps(memberId: string, caps: CapValues) {
  return supabase.rpc("set_member_capabilities", {
    p_member_id: memberId,
    p_is_manager: caps.isManager,
    p_finance: caps.finance,
    p_service_calls: caps.serviceCalls,
    p_approve: caps.approve,
    p_files: caps.files,
  });
}

/** Admin: remove a member (the DB blocks removing an org's last manager). */
export async function removeOrgMember(memberId: string) {
  return supabase.rpc("remove_org_member", { p_member_id: memberId });
}

/** Manager: request the studio add a teammate (notifies the admin). Returns
 * the new request id. is_manager isn't requestable - the admin decides that. */
export async function requestMemberInvite(params: {
  fullName?: string | null;
  email: string;
  phone?: string | null;
  note?: string | null;
  caps: Omit<CapValues, "isManager">;
}) {
  return supabase.rpc("request_member_invite", {
    p_full_name: params.fullName ?? null,
    p_email: params.email,
    p_phone: params.phone ?? null,
    p_note: params.note ?? null,
    p_finance: params.caps.finance,
    p_service_calls: params.caps.serviceCalls,
    p_approve: params.caps.approve,
    p_files: params.caps.files,
  });
}

/** Admin: approve a pending request, adding the member with the (possibly
 * adjusted) manager flag + capabilities. */
export async function approveMemberInvite(id: string, caps: CapValues) {
  return supabase.rpc("approve_member_invite", {
    p_id: id,
    p_is_manager: caps.isManager,
    p_finance: caps.finance,
    p_service_calls: caps.serviceCalls,
    p_approve: caps.approve,
    p_files: caps.files,
  });
}

/** Admin: reject a pending request. */
export async function rejectMemberInvite(id: string) {
  return supabase.rpc("reject_member_invite", { p_id: id });
}
