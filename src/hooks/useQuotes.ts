import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PriceQuote, QuoteCatalogRow } from "@/types/database";

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
