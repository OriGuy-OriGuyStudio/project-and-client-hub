import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { SectionShell } from "@/components/project/SectionShell";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import type { ActivityLog } from "@/types/database";

export function ActivityFeed({ projectId }: { projectId: string }) {
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["activity", projectId],
    queryFn: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: new entries appear without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`activity:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `project_id=eq.${projectId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["activity", projectId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);

  return (
    <SectionShell icon={Activity} iconClass="text-brand-cyan-base" title="יומן פעילות">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !items?.length ? (
        <EmptyState
          icon={Activity}
          title="אין עדיין פעילות"
          description="פעולות בפרויקט יירשמו כאן באופן אוטומטי."
        />
      ) : (
        <ol className="relative space-y-4 pe-4">
          {items.map((item) => (
            <li key={item.id} className="relative ps-4">
              <span className="absolute end-0 top-1.5 size-2 rounded-full bg-brand-cyan-base" />
              <p className="text-sm text-foreground">{item.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleString("he-IL")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionShell>
  );
}
