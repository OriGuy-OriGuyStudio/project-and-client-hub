// Quote system v2 , data hooks (Supabase + TanStack Query).
// Pure Supabase integration; the pricing/content math itself lives in
// lib/quote-pricing.ts + lib/quote-v2.ts and is unit-tested there.
// See spec 2026-07-15-quote-system-v2-design.md.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { QuoteType } from "@/lib/quote-pricing";
import {
  emptyQuoteV2,
  type QuoteContentV2,
  type QuoteBonus,
  type QuoteDiff,
  type QuoteFaq,
  type QuotePayment,
  type QuotePhase,
  type QuoteStep,
  type QuoteTestimonial,
} from "@/lib/quote-v2";
import type { PriceQuote, QuoteCatalogRow, QuoteDefaultsRow, QuoteTypeMultipliersRow } from "@/types/database";

// ---- catalog ---------------------------------------------------------------

/** The full "ready-made" catalog (subtypes/pages/features/modules/automations/
 *  upsells), sorted for display. The builder UI picks rows by (kind, type)
 *  itself via `catalogFor` below; kept as a flat list here to stay simple. */
export function useQuoteCatalog() {
  return useQuery({
    queryKey: ["quote-catalog"],
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

/** Selector: catalog rows of one `kind`, scoped to a quote `type`. Rows with
 *  `type = null` are universal (e.g. upsells) and match every type. */
export function catalogFor(
  rows: QuoteCatalogRow[] | undefined,
  kind: QuoteCatalogRow["kind"],
  type: QuoteType,
): QuoteCatalogRow[] {
  return (rows ?? []).filter((r) => r.kind === kind && (r.type === null || r.type === type));
}

// ---- per-type multipliers ---------------------------------------------------

export type QuoteMultiplierEntry = { fair: number; recommended: number; premium: number; floor: number };
export type QuoteMultipliersMap = Record<QuoteType, QuoteMultiplierEntry>;

/** Sane fallbacks matching the seed row in migration 20260715120000_quote_v2_schema. */
export const DEFAULT_QUOTE_MULTIPLIERS: QuoteMultipliersMap = {
  website: { fair: 1, recommended: 1.25, premium: 1.5, floor: 4500 },
  system: { fair: 1, recommended: 1.25, premium: 1.5, floor: 12000 },
  automation: { fair: 1, recommended: 1.25, premium: 1.5, floor: 2500 },
};

/** Per-type pricing multipliers + premium floor, as a `{fair,recommended,
 *  premium,floor}` map keyed by QuoteType. Missing rows fall back to
 *  DEFAULT_QUOTE_MULTIPLIERS so the pricing engine always has something to use. */
export function useQuoteMultipliers() {
  return useQuery({
    queryKey: ["quote-multipliers"],
    queryFn: async (): Promise<QuoteMultipliersMap> => {
      const { data, error } = await supabase.from("quote_type_multipliers").select("*");
      if (error) throw error;
      const map: QuoteMultipliersMap = {
        website: { ...DEFAULT_QUOTE_MULTIPLIERS.website },
        system: { ...DEFAULT_QUOTE_MULTIPLIERS.system },
        automation: { ...DEFAULT_QUOTE_MULTIPLIERS.automation },
      };
      for (const row of (data ?? []) as QuoteTypeMultipliersRow[]) {
        map[row.type] = { fair: row.fair, recommended: row.recommended, premium: row.premium, floor: row.floor };
      }
      return map;
    },
  });
}

// ---- quotes list / single --------------------------------------------------

/** All price quotes (v2), newest first. Admin-only at the DB level (RLS). */
export function useQuotesV2() {
  return useQuery({
    queryKey: ["quotes-v2"],
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

/** A single quote by id (the builder's edit target). Disabled without an id. */
export function useQuoteV2(id: string | null | undefined) {
  return useQuery({
    queryKey: ["quote-v2", id],
    enabled: !!id,
    queryFn: async (): Promise<PriceQuote | null> => {
      const { data, error } = await supabase.from("price_quotes").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as PriceQuote | null) ?? null;
    },
  });
}

// ---- studio-wide defaults ---------------------------------------------------

/** The subset of QuoteContentV2 that the studio-wide `quote_defaults` row
 *  seeds into every new quote (everything else, e.g. scope/pricing/upsells, is
 *  specific to the quote and starts empty via `emptyQuoteV2`). */
export type QuoteDefaultsContent = {
  differentiators: QuoteDiff[];
  phases: QuotePhase[];
  bonuses: QuoteBonus[];
  next_steps: QuoteStep[];
  faq: QuoteFaq[];
  legal: string[];
  payment: QuotePayment;
  testimonial: QuoteTestimonial | null;
  validity_days: number;
};

/** Studio defaults with no DB row yet (mirrors emptyQuoteV2's own fallbacks). */
const FALLBACK_QUOTE_DEFAULTS: QuoteDefaultsContent = {
  differentiators: [],
  phases: [],
  bonuses: [],
  next_steps: [],
  faq: [],
  legal: [],
  payment: { deposit_pct: 50 },
  testimonial: null,
  validity_days: 7,
};

function isEmptyRecord(v: unknown): boolean {
  return !v || typeof v !== "object" || Object.keys(v as Record<string, unknown>).length === 0;
}

/** Reads the single `quote_defaults` row (there should be at most one) and
 *  maps it to the v2 content-defaults shape. Falls back to
 *  FALLBACK_QUOTE_DEFAULTS (id: null) when the table is empty. Shared by the
 *  hook below and by `createQuoteV2`, which needs the same data outside a
 *  component. */
async function fetchQuoteDefaultsContent(): Promise<QuoteDefaultsContent & { id: string | null }> {
  const { data, error } = await supabase.from("quote_defaults").select("*").limit(1).maybeSingle();
  if (error) throw error;
  const row = data as QuoteDefaultsRow | null;
  if (!row) return { id: null, ...FALLBACK_QUOTE_DEFAULTS };
  return {
    id: row.id,
    differentiators: (row.differentiators as QuoteDiff[]) ?? [],
    phases: (row.phases as QuotePhase[]) ?? [],
    bonuses: (row.bonuses as QuoteBonus[]) ?? [],
    next_steps: (row.next_steps as QuoteStep[]) ?? [],
    faq: (row.faq as QuoteFaq[]) ?? [],
    legal: (row.legal as string[]) ?? [],
    payment: isEmptyRecord(row.payment) ? FALLBACK_QUOTE_DEFAULTS.payment : (row.payment as QuotePayment),
    testimonial: isEmptyRecord(row.testimonial) ? null : (row.testimonial as QuoteTestimonial),
    validity_days: row.validity_days ?? FALLBACK_QUOTE_DEFAULTS.validity_days,
  };
}

/** The studio-wide quote boilerplate (differentiators/phases/bonuses/next
 *  steps/FAQ/legal/payment/testimonial/validity), admin-edited once and reused
 *  by every new quote via `createQuoteV2`. */
export function useQuoteDefaultsV2() {
  return useQuery({
    queryKey: ["quote-defaults-v2"],
    queryFn: fetchQuoteDefaultsContent,
  });
}

/** Admin: upsert the single `quote_defaults` row. Pass `id: null` (or
 *  omitted) to insert the first-ever row; pass the existing id to update it. */
export function useSaveQuoteDefaultsV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuoteDefaultsContent & { id?: string | null }): Promise<string> => {
      const payload = {
        differentiators: input.differentiators,
        phases: input.phases,
        bonuses: input.bonuses,
        next_steps: input.next_steps,
        faq: input.faq,
        legal: input.legal,
        payment: input.payment,
        testimonial: input.testimonial ?? {},
        validity_days: input.validity_days,
        updated_at: new Date().toISOString(),
      };
      if (input.id) {
        const { error } = await supabase.from("quote_defaults").update(payload).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase.from("quote_defaults").insert(payload).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-defaults-v2"] });
    },
  });
}

// ---- new quote ---------------------------------------------------------

/** A fresh v2 quote content object for `type`, seeded with the studio-wide
 *  boilerplate (differentiators/phases/bonuses/next steps/FAQ/legal/payment/
 *  testimonial/validity). Everything quote-specific (scope, pricing, upsells,
 *  narrative...) starts empty via `emptyQuoteV2`. */
export function newQuoteContentFromDefaults(type: QuoteType, defaults: QuoteDefaultsContent): QuoteContentV2 {
  return {
    ...emptyQuoteV2(type),
    differentiators: defaults.differentiators,
    phases: defaults.phases,
    bonuses: defaults.bonuses,
    next_steps: defaults.next_steps,
    faq: defaults.faq,
    legal: defaults.legal,
    payment: defaults.payment,
    testimonial: defaults.testimonial,
    validity_days: defaults.validity_days,
  };
}

/** Inserts a new draft quote of `type`, seeded from the studio defaults, and
 *  returns its id. Plain async fn (not a hook) so it can be called from an
 *  event handler / "new quote" nav action; callers should invalidate
 *  `["quotes-v2"]` (see `useCreateQuoteV2` for a ready-made mutation form). */
export async function createQuoteV2(type: QuoteType): Promise<string> {
  const defaults = await fetchQuoteDefaultsContent();
  const content = newQuoteContentFromDefaults(type, defaults);
  const { data, error } = await supabase
    .from("price_quotes")
    .insert({
      type,
      status: "draft",
      content: content as unknown as Record<string, unknown>,
      final_price: content.final_price,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Mutation form of `createQuoteV2` for components that want the standard
 *  TanStack Query mutate/isPending affordances; invalidates the quotes list. */
export function useCreateQuoteV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: QuoteType) => createQuoteV2(type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes-v2"] });
    },
  });
}

// ---- save (builder) --------------------------------------------------------

/** Persists the builder's working `content` back to a `price_quotes` row,
 *  keeping the denormalized top-level columns (type/subtype/anchor_value/
 *  final_price) in sync for the future list/send views. Used by the quote
 *  builder's "שמירה" action (see pages/admin/quote/QuoteBuilder.tsx). */
export function useUpdateQuoteContentV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      type: QuoteType;
      subtype: string | null;
      content: QuoteContentV2;
      anchor: number;
    }): Promise<void> => {
      const { error } = await supabase
        .from("price_quotes")
        .update({
          type: input.type,
          subtype: input.subtype,
          content: input.content as unknown as Record<string, unknown>,
          anchor_value: input.anchor,
          final_price: input.content.final_price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["quote-v2", vars.id] });
      qc.invalidateQueries({ queryKey: ["quotes-v2"] });
    },
  });
}
