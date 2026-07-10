import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  ProjectService,
  SiteMetric,
  MaintenanceLog,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallAttachment,
  ServiceAgreement,
} from "@/types/database";

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

/** The current client's own signed service agreements (RLS-scoped to them). */
export function useMyAgreements() {
  return useQuery({
    queryKey: ["my-agreements"],
    queryFn: async (): Promise<ServiceAgreement[]> => {
      const { data, error } = await supabase
        .from("service_agreements")
        .select("*")
        .order("created_at", { ascending: false });
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

/** Client (or admin) opens a service call: creates it + notifies the studio. */
export async function openServiceCall(
  projectId: string,
  title: string,
  description: string,
  attachments: ServiceCallAttachment[] = [],
) {
  const { data, error } = await supabase.rpc("open_service_call", {
    p_project: projectId,
    p_title: title,
    p_description: description || null,
    p_attachments: attachments as unknown as never,
  });
  return { data, error };
}

export type MaintenanceOverviewRow = {
  project_id: string;
  project_title: string;
  client_name: string | null;
  client_email: string | null;
  tier: "core" | "pro" | "ultra";
  site_type: "wordpress" | "custom";
  site_url: string | null;
  hourly_rate: number | null;
  monthly_price: number | null;
  preview_token: string | null;
  pagespeed: number | null;
  uptime_pct: number | null;
  threats_blocked: number | null;
  lcp_ms: number | null;
  last_metric_date: string | null;
  hours_month: number;
  open_calls: number;
};

/** Admin: every active package with its latest metrics + open calls. */
export function useMaintenanceOverview() {
  return useQuery({
    queryKey: ["maintenance-overview"],
    queryFn: async (): Promise<MaintenanceOverviewRow[]> => {
      const { data, error } = await supabase.rpc("admin_maintenance_overview");
      if (error) throw error;
      return (data ?? []) as MaintenanceOverviewRow[];
    },
  });
}

/** Admin: run the PageSpeed poll on demand (fills today's metrics now). */
export async function refreshSiteMetrics(projectId?: string) {
  return supabase.functions.invoke("poll-site-metrics", { body: projectId ? { project_id: projectId } : {} });
}

export type SiteInsights = {
  assessment: string;
  recommendations: { area: string; text: string }[];
  fetchedPage?: boolean;
};

/** Admin: email the client their monthly report (+ ensure the report link). */
export async function sendReport(projectId: string): Promise<{ link: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("send-report", { body: { project_id: projectId } });
  if (error) return { link: null, error: error.message };
  if (data && data.ok === false) return { link: null, error: data.error ?? "failed" };
  return { link: data?.link ?? null, error: null };
}

/** Admin: AI (Gemini) performance/security/UX review + recommendations for a site. */
export async function siteInsights(projectId: string): Promise<{ data: SiteInsights | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("site-insights", { body: { project_id: projectId } });
  if (error) return { data: null, error: error.message };
  if (data && data.ok === false) return { data: null, error: data.error ?? "failed" };
  return { data: data as SiteInsights, error: null };
}

export type ServicePreview = {
  service: ProjectService;
  project_title: string;
  business_name: string;
  metrics: SiteMetric[];
  log: MaintenanceLog[];
  summary: ServiceSummary;
};

/** Public, read-only dashboard snapshot for a share token (anon-callable). */
export async function fetchServicePreview(token: string): Promise<ServicePreview | null> {
  const { data, error } = await supabase.rpc("service_preview", { p_token: token });
  if (error) throw error;
  return (data as ServicePreview) ?? null;
}

/** Admin opens a service call on a client's behalf (proactive). */
export async function adminOpenServiceCall(projectId: string, title: string, description: string) {
  const { data, error } = await supabase.rpc("admin_open_service_call", {
    p_project: projectId,
    p_title: title,
    p_description: description || null,
  });
  return { data, error };
}

/** Service calls for one project (client sees own; admin sees all). */
export function useServiceCalls(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["service-calls", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ServiceCall[]> => {
      const { data, error } = await supabase
        .from("service_calls")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ServiceCallRow = ServiceCall & {
  project_title: string | null;
  client_name: string | null;
};

/** All service calls (admin inbox), newest first, with project + client names. */
export function useAllServiceCalls() {
  return useQuery({
    queryKey: ["service-calls-all"],
    queryFn: async (): Promise<ServiceCallRow[]> => {
      const { data, error } = await supabase
        .from("service_calls")
        .select("*, project:projects(title), client:profiles(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      return ((data as any[]) ?? []).map((r) => ({
        ...(r as ServiceCall),
        project_title: r.project?.title ?? null,
        client_name: r.client?.full_name ?? null,
      }));
    },
  });
}

/** Admin: update a call's internal name / status (resolved_at auto on done). */
export async function updateServiceCall(
  id: string,
  patch: { status?: ServiceCallStatus; admin_label?: string | null },
) {
  const row: Partial<ServiceCall> = { ...patch };
  if (patch.status) row.resolved_at = patch.status === "done" ? new Date().toISOString() : null;
  const { error } = await supabase.from("service_calls").update(row).eq("id", id);
  // Client in-app notification fires via the DB trigger. Email the client
  // best-effort when the status moved to a client-visible stage.
  if (!error && (patch.status === "in_progress" || patch.status === "done")) {
    void supabase.functions.invoke("notify-service-status", { body: { callId: id } });
  }
  return { error };
}

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
