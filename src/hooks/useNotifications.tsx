import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@/types/database";

export function useNotifications() {
  const qc = useQueryClient();
  const { status } = useAuth();

  const query = useQuery({
    enabled: status === "authenticated",
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Live updates - new notifications appear without a refresh.
  // Unique channel name per subscription: this hook runs in more than one
  // component (bell + sidebar), and a shared channel name would collide
  // ("cannot add postgres_changes callbacks after subscribe()").
  useEffect(() => {
    if (status !== "authenticated") return;
    const channel = supabase
      .channel(`notifications-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [status, qc]);

  const items = query.data ?? [];
  const unread = items.filter((n) => !n.is_read).length;
  // For highlighting the exact item that changed in a list.
  const unreadProjectIds = new Set(
    items.filter((n) => !n.is_read && n.project_id).map((n) => n.project_id as string)
  );
  const unreadEntityIds = new Set(
    items.filter((n) => !n.is_read && n.entity_id).map((n) => n.entity_id as string)
  );

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return {
    items,
    unread,
    unreadProjectIds,
    unreadEntityIds,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  };
}
