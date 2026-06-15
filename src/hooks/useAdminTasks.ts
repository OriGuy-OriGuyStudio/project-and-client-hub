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

export interface AdminTasks {
  redemptions: AdminTaskRedemption[];
  messages: AdminTaskMessage[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Things waiting for the admin: pending store redemptions + chat threads whose
 *  last message is from the client (i.e. awaiting a reply). */
export function useAdminTasks(adminId?: string) {
  return useQuery({
    queryKey: ["admin-tasks", adminId],
    queryFn: async (): Promise<AdminTasks> => {
      const [pr, cr, msgs] = await Promise.all([
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

      return { redemptions, messages };
    },
  });
}
