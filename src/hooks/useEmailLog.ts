import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** One row of `email_log` , written by the Edge Function mailers (service role)
 *  after every Gmail attempt, success or failure. Admin-only by RLS. */
export type EmailLogRow = {
  id: string;
  kind: string;
  to_email: string;
  subject: string;
  html: string | null;
  ok: boolean;
  error: string | null;
  context: Record<string, unknown>;
  created_at: string;
};

/** The whole log, newest first. Capped so a long history can't blow up the
 *  page; the filters in the UI narrow the same fetched window. */
export function useEmailLog(limit = 300) {
  return useQuery({
    queryKey: ["email-log", limit],
    queryFn: async (): Promise<EmailLogRow[]> => {
      const { data, error } = await supabase
        .from("email_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as EmailLogRow[];
    },
  });
}

/** email → who that is, so the log can be filtered by person instead of by a
 *  raw address. Covers clients, partners and the admin alike (one profiles
 *  fetch, matched case-insensitively since mail addresses are). */
export type RecipientInfo = { id: string; name: string; role: string };

export function useEmailRecipients() {
  return useQuery({
    queryKey: ["email-recipients"],
    queryFn: async (): Promise<Record<string, RecipientInfo>> => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, role");
      if (error) throw error;
      const map: Record<string, RecipientInfo> = {};
      for (const p of data ?? []) {
        const email = (p.email ?? "").trim().toLowerCase();
        if (!email) continue;
        map[email] = { id: p.id, name: (p.full_name ?? "").trim() || email, role: p.role ?? "" };
      }
      return map;
    },
  });
}

export function useDeleteEmailLogRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_log").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-log"] }),
  });
}
