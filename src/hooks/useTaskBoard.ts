import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AdminTask, AdminTaskGroup } from "@/types/database";

/** Collapsible task groups ("סבב תיקונים 3"), ordered. Admin-only via RLS. */
export function useTaskBoardGroups() {
  return useQuery({
    queryKey: ["task-board-groups"],
    queryFn: async (): Promise<AdminTaskGroup[]> => {
      const { data, error } = await supabase
        .from("admin_task_groups")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** All of the admin's private board tasks, ordered. Admin-only via RLS. */
export function useTaskBoardTasks() {
  return useQuery({
    queryKey: ["task-board-tasks"],
    queryFn: async (): Promise<AdminTask[]> => {
      const { data, error } = await supabase
        .from("admin_tasks")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
