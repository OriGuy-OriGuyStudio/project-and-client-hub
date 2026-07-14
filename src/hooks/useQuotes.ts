import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PriceQuote, QuoteCatalogRow, QuoteDefaultsRow } from "@/types/database";
import { fallbackQuoteDefaults, type QuoteDefaults } from "@/lib/quote";

/** Admin: all price quotes, newest first. */
export function useQuotes() {
  return useQuery({
    queryKey: ["price-quotes"],
    queryFn: async (): Promise<PriceQuote[]> => {
      const { data, error } = await supabase
        .from("price_quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceQuote[];
    },
  });
}

/** Admin: a single quote by id. */
export function useQuote(id: string | null | undefined) {
  return useQuery({
    queryKey: ["price-quote", id],
    enabled: !!id,
    queryFn: async (): Promise<PriceQuote | null> => {
      const { data, error } = await supabase.from("price_quotes").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as PriceQuote | null) ?? null;
    },
  });
}

/** Admin: the ready-made catalog (pages/features/upsells). */
export function useQuoteCatalog() {
  return useQuery({
    queryKey: ["quote-catalog"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<QuoteCatalogRow[]> => {
      const { data, error } = await supabase
        .from("quote_catalog")
        .select("*")
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuoteCatalogRow[];
    },
  });
}

/** Coerce a DB defaults row into the typed QuoteDefaults shape (with fallbacks). */
function rowToDefaults(row: QuoteDefaultsRow | null): QuoteDefaults {
  const fb = fallbackQuoteDefaults();
  if (!row) return fb;
  return {
    differentiators: (row.differentiators as QuoteDefaults["differentiators"]) ?? fb.differentiators,
    phases: (row.phases as QuoteDefaults["phases"]) ?? fb.phases,
    bonuses: (row.bonuses as QuoteDefaults["bonuses"]) ?? fb.bonuses,
    next_steps: (row.next_steps as QuoteDefaults["next_steps"]) ?? fb.next_steps,
    faq: (row.faq as QuoteDefaults["faq"]) ?? fb.faq,
    legal: (row.legal as string[]) ?? fb.legal,
    payment: (row.payment as QuoteDefaults["payment"]) ?? fb.payment,
    validity_days: row.validity_days ?? fb.validity_days,
  };
}

/** Admin: the one studio-wide defaults row (id + typed content). */
export function useQuoteDefaults() {
  return useQuery({
    queryKey: ["quote-defaults"],
    queryFn: async (): Promise<{ id: string | null; defaults: QuoteDefaults }> => {
      const { data, error } = await supabase.from("quote_defaults").select("*").limit(1).maybeSingle();
      if (error) throw error;
      const row = (data as QuoteDefaultsRow | null) ?? null;
      return { id: row?.id ?? null, defaults: rowToDefaults(row) };
    },
  });
}

/** Admin: save the studio-wide defaults (upsert the single row). */
export function useSaveQuoteDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, defaults }: { id: string | null; defaults: QuoteDefaults }) => {
      const payload = { ...defaults, updated_at: new Date().toISOString() };
      if (id) {
        const { error } = await supabase.from("quote_defaults").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quote_defaults").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote-defaults"] }),
  });
}

export interface PublicQuote {
  id: string;
  title: string;
  client_name: string | null;
  site_type: string;
  status: string;
  content: Record<string, unknown>;
  selected: Record<string, unknown>;
  signed_name: string | null;
  signed_at: string | null;
  created_at: string | null;
  org_name: string | null;
}

/** Client page: fetch a quote by its share token (public, definer RPC). */
export function usePublicQuote(token: string | null | undefined) {
  return useQuery({
    queryKey: ["public-quote", token],
    enabled: !!token,
    queryFn: async (): Promise<PublicQuote | null> => {
      const { data, error } = await supabase.rpc("get_quote_public", { p_token: token! });
      if (error) throw error;
      return (data as PublicQuote | null) ?? null;
    },
  });
}
