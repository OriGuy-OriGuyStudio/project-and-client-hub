import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AdminTaskRedemption {
  id: string;
  kind: "partner" | "client";
  recipientId: string;
  recipientName: string;
  rewardName: string;
  amount: number;
}

export interface AdminTaskMessage {
  projectId: string;
  projectTitle: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface AdminTaskAccessRequest {
  id: string;
  email: string;
  fullName: string;
  businessName: string | null;
  phone: string | null;
  message: string | null;
}

export interface AdminTaskLead {
  id: string;
  partnerName: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
  projectType: string | null;
}

export interface AdminTaskFeedback {
  id: string;
  clientName: string;
  message: string;
}

export interface AdminTaskLoginAttempt {
  id: string;
  email: string;
  createdAt: string;
}

export interface AdminTaskServiceCall {
  id: string;
  title: string;
  status: string;
  projectId: string;
  projectTitle: string;
  clientName: string;
  createdAt: string;
}

export interface AdminTaskAgreement {
  id: string;
  clientId: string | null;
  projectId: string | null;
  fullName: string;
  business: string | null;
  phone: string | null;
  tier: string;
  monthlyPrice: number | null;
  billingCycle: string | null;
  createdAt: string;
}

export interface AdminTasks {
  redemptions: AdminTaskRedemption[];
  messages: AdminTaskMessage[];
  accessRequests: AdminTaskAccessRequest[];
  leads: AdminTaskLead[];
  feedback: AdminTaskFeedback[];
  loginAttempts: AdminTaskLoginAttempt[];
  serviceCalls: AdminTaskServiceCall[];
  agreements: AdminTaskAgreement[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Things waiting for the admin: pending store redemptions + chat threads whose
 *  last message is from the client (i.e. awaiting a reply). */
export function useAdminTasks(adminId?: string) {
  return useQuery({
    queryKey: ["admin-tasks", adminId],
    queryFn: async (): Promise<AdminTasks> => {
      const [pr, cr, msgs, ar, ld, pp, fb, la, sc, ag, ps] = await Promise.all([
        supabase
          .from("partner_reward_redemptions")
          .select("id, coins_spent, partner_id, reward:rewards(name), partner:profiles(full_name)")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("reward_redemptions")
          .select("id, credits_spent, client_id, reward:rewards(name), client:profiles(full_name)")
          .eq("status", "pending")
          .order("redeemed_at", { ascending: true }),
        supabase
          .from("messages")
          .select("project_id, sender_id, content, created_at, project:projects(title), sender:profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("access_requests")
          .select("id, email, full_name, business_name, phone, message")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("partner_leads")
          .select("id, lead_name, lead_phone, lead_email, project_type, partner_id")
          .eq("status", "submitted")
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, full_name"),
        supabase
          .from("client_feedback")
          .select("id, message, client_id")
          .eq("status", "open")
          .order("created_at", { ascending: true }),
        supabase
          .from("notifications")
          .select("id, body, created_at")
          .eq("type", "login_attempt")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("service_calls")
          .select("id, title, status, project_id, client_id, created_at, project:projects(title), client:profiles(full_name)")
          .in("status", ["new", "scheduled", "in_progress"])
          .order("created_at", { ascending: true }),
        supabase
          .from("service_agreements")
          .select("id, client_id, project_id, full_name, business, phone, tier, monthly_price, billing_cycle, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("project_service")
          .select("project_id, project:projects(client_id)")
          .eq("active", true),
      ]);

      const redemptions: AdminTaskRedemption[] = [
        ...(((pr.data as any[]) ?? []).map((r) => ({
          id: r.id,
          kind: "partner" as const,
          recipientId: r.partner_id,
          recipientName: r.partner?.full_name ?? "שותף",
          rewardName: r.reward?.name ?? "פרס",
          amount: r.coins_spent,
        }))),
        ...(((cr.data as any[]) ?? []).map((r) => ({
          id: r.id,
          kind: "client" as const,
          recipientId: r.client_id,
          recipientName: r.client?.full_name ?? "לקוח",
          rewardName: r.reward?.name ?? "פרס",
          amount: r.credits_spent,
        }))),
      ];

      // Latest message per project; keep only those whose latest isn't the admin's.
      const seen = new Set<string>();
      const messages: AdminTaskMessage[] = [];
      for (const m of (msgs.data as any[]) ?? []) {
        if (seen.has(m.project_id)) continue;
        seen.add(m.project_id);
        if (adminId && m.sender_id === adminId) continue;
        messages.push({
          projectId: m.project_id,
          projectTitle: m.project?.title ?? "פרויקט",
          senderName: m.sender?.full_name ?? "לקוח",
          content: m.content,
          createdAt: m.created_at,
        });
      }

      const accessRequests: AdminTaskAccessRequest[] = (((ar.data as any[]) ?? []).map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name ?? r.email,
        businessName: r.business_name,
        phone: r.phone,
        message: r.message,
      })));

      const nameById = new Map<string, string>();
      for (const p of (pp.data as any[]) ?? []) nameById.set(p.id, p.full_name ?? "");
      const leads: AdminTaskLead[] = (((ld.data as any[]) ?? []).map((r) => ({
        id: r.id,
        partnerName: nameById.get(r.partner_id) || "שותף",
        leadName: r.lead_name,
        leadPhone: r.lead_phone,
        leadEmail: r.lead_email,
        projectType: r.project_type,
      })));

      const feedback: AdminTaskFeedback[] = (((fb.data as any[]) ?? []).map((r) => ({
        id: r.id,
        clientName: nameById.get(r.client_id) || "לקוח",
        message: r.message,
      })));

      const loginAttempts: AdminTaskLoginAttempt[] = (((la.data as any[]) ?? []).map((n) => ({
        id: n.id,
        email: n.body ?? "",
        createdAt: n.created_at,
      })));

      const serviceCalls: AdminTaskServiceCall[] = (((sc.data as any[]) ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        projectId: r.project_id,
        projectTitle: r.project?.title ?? "פרויקט",
        clientName: r.client?.full_name ?? "לקוח",
        createdAt: r.created_at,
      })));

      // A signed agreement is "waiting" until the client is actually set up.
      // It clears once the client has ANY active package (or the linked project
      // is opened). We also collapse multiple signings by the same client into a
      // single card (a client who signed 3× shouldn't produce 3 to-dos).
      const openServiceProjects = new Set<string>();
      const openServiceClients = new Set<string>();
      for (const r of (ps.data as any[]) ?? []) {
        if (r.project_id) openServiceProjects.add(r.project_id);
        const cid = r.project?.client_id;
        if (cid) openServiceClients.add(cid);
      }
      const recentCutoff = Date.now() - 21 * 864e5;
      const seenAgreementKeys = new Set<string>();
      const agreements: AdminTaskAgreement[] = (((ag.data as any[]) ?? [])
        .filter((r) => {
          if (r.project_id) {
            // Linked: pending until THIS project has an active package (a client
            // with another active project still gets a card for a new project).
            if (openServiceProjects.has(r.project_id)) return false;
          } else {
            // Unlinked (legacy/anomaly): clear once the client is set up anywhere,
            // or after a short window, since there's no project to resolve against.
            if (r.client_id && openServiceClients.has(r.client_id)) return false;
            if (new Date(r.created_at).getTime() < recentCutoff) return false;
          }
          // One card per project (linked) or per client (unlinked).
          const key = r.project_id || r.client_id || r.id;
          if (seenAgreementKeys.has(key)) return false;
          seenAgreementKeys.add(key);
          return true;
        })
        .map((r) => ({
          id: r.id,
          clientId: r.client_id,
          projectId: r.project_id,
          fullName: r.full_name ?? "לקוח",
          business: r.business,
          phone: r.phone,
          tier: r.tier,
          monthlyPrice: r.monthly_price != null ? Number(r.monthly_price) : null,
          billingCycle: r.billing_cycle,
          createdAt: r.created_at,
        })));

      return { redemptions, messages, accessRequests, leads, feedback, loginAttempts, serviceCalls, agreements };
    },
  });
}
