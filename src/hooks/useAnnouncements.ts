import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Announcement } from "@/types/database";

/**
 * Active announcements for the current client/partner that they haven't
 * dismissed yet, newest first. RLS already scopes rows to the user's role +
 * `is_active`; we additionally drop any the user has closed.
 */
export function useActiveAnnouncements() {
  const { user } = useAuth();

  return useQuery({
    enabled: !!user?.id,
    queryKey: ["announcements", "active", user?.id],
    queryFn: async (): Promise<Announcement[]> => {
      const [annc, dismissed] = await Promise.all([
        supabase
          .from("announcements")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("announcement_dismissals").select("announcement_id"),
      ]);
      if (annc.error) throw annc.error;
      const hidden = new Set((dismissed.data ?? []).map((d) => d.announcement_id));
      return (annc.data ?? []).filter((a) => !hidden.has(a.id));
    },
  });
}

/** Permanently dismiss an announcement for the current user. */
export function useDismissAnnouncement() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("announcement_dismissals")
        .insert({ announcement_id: announcementId, user_id: user.id });
      // Ignore a duplicate (already dismissed) — anything else propagates.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", "active", user?.id] });
    },
  });
}
