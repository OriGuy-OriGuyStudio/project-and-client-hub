import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  AdminClientNote,
  ClientCallLog,
  MemberInviteRequest,
  OrgMemberRow,
  Project,
} from "@/types/database";
import type { CapValues } from "@/components/org/capabilityFields";

/** Resolves the org a given client (any member, not just the founder) belongs
 * to - read from `organization_members`, the authoritative membership table
 * (not `client_brand`, which post-brand-to-org only has a row per business,
 * not per member). null when the client has no org yet (rare -
 * pre-onboarding). Plain async fn so CRM write sites can resolve `org_id`
 * before an insert/upsert without a hook (see Clients.tsx). */
export async function resolveClientOrgId(clientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", clientId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.org_id ?? null;
}

/** The organization a client (any member, not just the founder) belongs to -
 * see `resolveClientOrgId` above. null when the client has no org yet (rare -
 * pre-onboarding). */
export function useClientOrgId(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-org", clientId],
    enabled: !!clientId,
    queryFn: () => resolveClientOrgId(clientId!),
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

export interface OrgFounder {
  user_id: string;
  full_name: string | null;
  email: string;
}

/** The org's founding member (earliest to join, ties broken by user_id) - the
 * user Business Detail keys brand/CRM on for now. See the KNOWN LIMITATION
 * note in docs/superpowers/specs/2026-07-12-org-centric-admin-design.md:
 * brand+CRM stay per-member until Phase 2/3 repoints them to the org. */
export function useOrgFounder(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-founder", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgFounder | null> => {
      const { data: member, error: memberError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: true })
        .order("user_id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!member) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", member.user_id)
        .maybeSingle();
      if (profileError) throw profileError;

      return {
        user_id: member.user_id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? "",
      };
    },
  });
}

/** One `admin_client_notes` row with its person's display name resolved (the
 * table itself only has `client_id` - see `useOrgNotes` below). */
export interface OrgNoteRow extends AdminClientNote {
  full_name: string | null;
  email: string;
}

/** Admin: an org's private CRM notes - one row per person (Task 11: CRM moves
 * to the org level; each business can have several team members, each with
 * their own note/role/gender). Resolves every note's display name via
 * `profiles` in a second query (notes don't carry the name themselves), and
 * sorts by name so Business Detail lists people in a stable order. */
export function useOrgNotes(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-notes", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgNoteRow[]> => {
      const { data: notes, error } = await supabase
        .from("admin_client_notes")
        .select("*")
        .eq("org_id", orgId!);
      if (error) throw error;
      if (!notes?.length) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", notes.map((n) => n.client_id));
      if (profilesError) throw profilesError;

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      return notes
        .map((n) => {
          const p = profileById.get(n.client_id);
          return { ...n, full_name: p?.full_name ?? null, email: p?.email ?? "" };
        })
        .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, "he"));
    },
  });
}

/** Admin: an org's call log (Task 10: `client_call_logs.org_id`), newest
 * first - the Business Detail analog of the per-client call log. */
export function useOrgCallLogs(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-call-logs", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<ClientCallLog[]> => {
      const { data, error } = await supabase
        .from("client_call_logs")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Admin: an org's projects (across all its members' client_ids), for the
 * Business Detail projects table. */
export function useOrgProjects(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-projects", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("org_id", orgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
