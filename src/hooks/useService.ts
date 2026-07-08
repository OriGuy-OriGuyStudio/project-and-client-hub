import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProjectService, SiteMetric, MaintenanceLog } from "@/types/database";

/** Active service subscriptions the current user can see (client: their own). */
export function useMyServices() {
  return useQuery({
    queryKey: ["my-services"],
    queryFn: async (): Promise<ProjectService[]> => {
      const { data, error } = await supabase
        .from("project_service")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The service plan for one project (null if none / not visible). */
export function useProjectService(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-service", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectService | null> => {
      const { data, error } = await supabase
        .from("project_service")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Recent daily site metrics (newest first). */
export function useSiteMetrics(projectId: string | null | undefined, days = 30) {
  return useQuery({
    queryKey: ["site-metrics", projectId, days],
    enabled: !!projectId,
    queryFn: async (): Promise<SiteMetric[]> => {
      const { data, error } = await supabase
        .from("site_metrics")
        .select("*")
        .eq("project_id", projectId!)
        .order("metric_date", { ascending: false })
        .limit(days);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Recent maintenance-log entries (updates, backups, scans, service calls). */
export function useMaintenanceLog(projectId: string | null | undefined, limit = 30) {
  return useQuery({
    queryKey: ["maintenance-log", projectId, limit],
    enabled: !!projectId,
    queryFn: async (): Promise<MaintenanceLog[]> => {
      const { data, error } = await supabase
        .from("maintenance_log")
        .select("*")
        .eq("project_id", projectId!)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ServiceSummary = {
  hours_month: number;
  hours_total: number;
  service_calls_month: number;
  updates_total: number;
  backups_total: number;
  threats_total: number;
};

/** Safe aggregate (hours from admin-only time_sessions + counts) for a project. */
export function useServiceSummary(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["service-summary", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ServiceSummary | null> => {
      const { data, error } = await supabase.rpc("client_service_summary", { p_project: projectId! });
      if (error) throw error;
      return (data?.[0] as ServiceSummary) ?? null;
    },
  });
}
