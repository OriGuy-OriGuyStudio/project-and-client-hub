import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import type { ProjectBilling, ProjectStage, TimeLabel, TimeSession } from "@/types/database";

/* ---------------- personal labels (with CRUD) ---------------- */
export function useTimeLabels() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["time-labels"],
    queryFn: async (): Promise<TimeLabel[]> => {
      const { data, error } = await supabase
        .from("time_labels")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["time-labels"] });

  return {
    labels: q.data ?? [],
    isLoading: q.isLoading,
    async add(name: string) {
      const clean = name.trim();
      if (!clean) return;
      const next = (q.data?.reduce((m, l) => Math.max(m, l.order_index), -1) ?? -1) + 1;
      const { error } = await supabase.from("time_labels").insert({ name: clean, order_index: next });
      if (error) return toastError("הוספת התווית נכשלה (אולי כבר קיימת).");
      refresh();
    },
    async rename(id: string, name: string) {
      const clean = name.trim();
      if (!clean) return;
      const { error } = await supabase.from("time_labels").update({ name: clean }).eq("id", id);
      if (error) return toastError("שינוי השם נכשל.");
      refresh();
    },
    async remove(id: string) {
      const { error } = await supabase.from("time_labels").delete().eq("id", id);
      if (error) return toastError("המחיקה נכשלה.");
      refresh();
    },
    /** Link (or unlink, with null) a personal label to a project. */
    async link(id: string, projectId: string | null) {
      const { error } = await supabase.from("time_labels").update({ project_id: projectId }).eq("id", id);
      if (error) return toastError("קישור התווית לפרויקט נכשל.");
      refresh();
    },
  };
}

/** Add/edit the free-text note on a single session, then refresh the reports. */
export async function saveSessionNote(id: string, note: string) {
  const clean = note.trim();
  const { error } = await supabase
    .from("time_sessions")
    .update({ note: clean || null })
    .eq("id", id);
  if (error) {
    toastError("שמירת ההערה נכשלה.");
    return false;
  }
  window.dispatchEvent(new Event("timer-session-saved"));
  return true;
}

/* ---------------- manual create / edit / delete of a session -------------- */
export type SessionInput = {
  kind: "stage" | "personal";
  project_id: string | null;
  stage_id: string | null;
  label: string | null;
  mode: "up" | "down";
  duration_seconds: number;
  started_at: string; // ISO
  note: string | null;
};

const endedFrom = (startedAt: string, durationSec: number) =>
  new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString();

export async function createManualSession(input: SessionInput) {
  const { error } = await supabase.from("time_sessions").insert({
    ...input,
    planned_seconds: null,
    ended_at: endedFrom(input.started_at, input.duration_seconds),
  });
  if (error) {
    toastError("שמירת הסשן נכשלה.");
    return false;
  }
  window.dispatchEvent(new Event("timer-session-saved"));
  toast({ title: "הסשן נשמר", variant: "success" });
  return true;
}

export async function updateSession(id: string, patch: SessionInput) {
  const { error } = await supabase
    .from("time_sessions")
    .update({ ...patch, ended_at: endedFrom(patch.started_at, patch.duration_seconds) })
    .eq("id", id);
  if (error) {
    toastError("עדכון הסשן נכשל.");
    return false;
  }
  window.dispatchEvent(new Event("timer-session-saved"));
  toast({ title: "הסשן עודכן", variant: "success" });
  return true;
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from("time_sessions").delete().eq("id", id);
  if (error) {
    toastError("מחיקת הסשן נכשלה.");
    return false;
  }
  window.dispatchEvent(new Event("timer-session-saved"));
  toast({ title: "הסשן נמחק", variant: "success" });
  return true;
}

/* ---------------- a project's stages (pulled live, never hardcoded) --------- */
export function useProjectStages(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-stages", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectStage[]> => {
      const { data, error } = await supabase
        .from("project_stages")
        .select("*")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------------- per-project value (admin-only) ---------------- */
export function useProjectBilling(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-billing", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectBilling | null> => {
      const { data, error } = await supabase
        .from("project_billing")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export async function saveProjectValue(projectId: string, value: number | null) {
  const { error } = await supabase
    .from("project_billing")
    .upsert({ project_id: projectId, value, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) {
    toastError("שמירת שווי הפרויקט נכשלה.");
    return false;
  }
  toast({ title: "שווי הפרויקט נשמר", variant: "success" });
  return true;
}

/* ---------------- all sessions (for reports); refetches on save ------------- */
export function useTimeSessions() {
  const qc = useQueryClient();
  useEffect(() => {
    const onSaved = () => qc.invalidateQueries({ queryKey: ["time-sessions"] });
    window.addEventListener("timer-session-saved", onSaved);
    return () => window.removeEventListener("timer-session-saved", onSaved);
  }, [qc]);

  return useQuery({
    queryKey: ["time-sessions"],
    queryFn: async (): Promise<TimeSession[]> => {
      const { data, error } = await supabase
        .from("time_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
}
