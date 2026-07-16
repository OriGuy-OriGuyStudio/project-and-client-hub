// Quote system v2 , data hooks (Supabase + TanStack Query).
// Pure Supabase integration; the pricing/content math itself lives in
// lib/quote-pricing.ts + lib/quote-v2.ts and is unit-tested there.
// See spec 2026-07-15-quote-system-v2-design.md.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { QuoteType, ScopeItemKind } from "@/lib/quote-pricing";
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
import type {
  PriceQuote,
  QuoteCatalogRow,
  QuoteDefaultsRow,
  QuoteMaintenanceTierRow,
  QuoteTypeMultipliersRow,
} from "@/types/database";

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

// ---- upsell catalog (admin-curated, picked by the builder) ----------------

/** All upsell rows (`kind='upsell'`), sorted for display, across every quote
 *  type , this is the admin-management view (QuoteDefaultsV2's CRUD section),
 *  which needs to see and edit every upsell regardless of its `type`. The
 *  builder's picker (UpsellsPicker) does its own type-scoped filtering over
 *  this same list (row.type === quote.type || row.type === null , null =
 *  universal). Selector over the same `["quote-catalog"]` query as
 *  `useQuoteCatalog`, so edits made on the defaults page
 *  (useSaveUpsellCatalogItem) and picks made in the builder always see the
 *  same cached list. */
export function useUpsellCatalog() {
  const query = useQuoteCatalog();
  return { ...query, data: (query.data ?? []).filter((r) => r.kind === "upsell") };
}

/** Admin input for creating/editing one upsell catalog row (the "ready-made"
 *  upsell, not a per-quote snapshot , see QuoteUpsell in lib/quote-v2.ts).
 *  `type` scopes the upsell to one quote type; `null` = universal (shown for
 *  every type). */
export type UpsellCatalogInput = {
  id?: string;
  label: string;
  description: string | null;
  base_price: number;
  recommended: boolean;
  type: QuoteType | null;
};

/** Admin: insert or update an upsell catalog row. New rows are appended after
 *  the current highest `sort` (so newly-added upsells show up last). New rows
 *  default to `type: "website"` when the caller doesn't set one. */
export function useSaveUpsellCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsellCatalogInput): Promise<string> => {
      if (input.id) {
        const { error } = await supabase
          .from("quote_catalog")
          .update({
            label: input.label,
            description: input.description,
            base_price: input.base_price,
            recommended: input.recommended,
            type: input.type,
          })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data: maxRow, error: maxError } = await supabase
        .from("quote_catalog")
        .select("sort")
        .eq("kind", "upsell")
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxError) throw maxError;
      const nextSort = ((maxRow as { sort: number } | null)?.sort ?? 0) + 10;
      const { data, error } = await supabase
        .from("quote_catalog")
        .insert({
          kind: "upsell",
          type: input.type ?? "website",
          label: input.label,
          description: input.description,
          base_price: input.base_price,
          default_mult: 1,
          recommended: input.recommended,
          sort: nextSort,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-catalog"] });
    },
  });
}

/** Admin: delete an upsell catalog row. Quotes that already picked it keep
 *  their own snapshot (QuoteUpsell copied into content.upsells), unaffected. */
export function useDeleteUpsellCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("quote_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-catalog"] });
    },
  });
}

// ---- generic catalog CRUD (subtypes/pages/features/modules/automations/upsells) --

/** Admin input for creating/editing any `quote_catalog` row, scope kinds
 *  (subtype/page/feature/module/automation) and upsells alike. Scope kinds
 *  always carry a concrete `type` (e.g. subtype/page/feature -> "website");
 *  only upsells use `type: null` for "כללי" (universal). */
export type CatalogItemInput = {
  id?: string;
  kind: ScopeItemKind | "upsell";
  type: QuoteType | null;
  label: string;
  description?: string | null;
  base_price: number;
  recommended?: boolean;
  sort?: number;
};

/** Admin: insert or update any `quote_catalog` row. New rows are appended
 *  after the current highest `sort` for that (kind, type) pair (10, then 20,
 *  30…) and default to `default_mult: 1`. Existing rows only ever update
 *  label/description/base_price/recommended , kind/type/sort don't change
 *  after creation in this UI. Powers both the per-type scope-item editors
 *  (QuoteDefaultsV2) and, via delegation, the upsell catalog CRUD below. */
export function useSaveCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CatalogItemInput): Promise<string> => {
      if (input.id) {
        const { error } = await supabase
          .from("quote_catalog")
          .update({
            label: input.label,
            description: input.description ?? null,
            base_price: input.base_price,
            ...(input.recommended !== undefined ? { recommended: input.recommended } : {}),
          })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      let nextSort = input.sort;
      if (nextSort === undefined) {
        let maxQuery = supabase.from("quote_catalog").select("sort").eq("kind", input.kind);
        maxQuery = input.type === null ? maxQuery.is("type", null) : maxQuery.eq("type", input.type);
        const { data: maxRow, error: maxError } = await maxQuery
          .order("sort", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (maxError) throw maxError;
        nextSort = ((maxRow as { sort: number } | null)?.sort ?? 0) + 10;
      }
      const { data, error } = await supabase
        .from("quote_catalog")
        .insert({
          kind: input.kind,
          type: input.type,
          label: input.label,
          description: input.description ?? null,
          base_price: input.base_price,
          default_mult: 1,
          recommended: input.recommended ?? false,
          sort: nextSort,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-catalog"] });
    },
  });
}

/** Admin: delete any `quote_catalog` row by id. Quotes that already snapshot
 *  it into their own content (scope items / upsells) keep their copy. */
export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("quote_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-catalog"] });
    },
  });
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

// ---- maintenance tier catalog (admin-curated, per product type) -----------

/** Admin-curated maintenance/retainer tiers for one quote `type`
 *  (`quote_maintenance_tiers`), ordered for display. The builder snapshots the
 *  tiers it offers into `content.maintenance.tiers` (see lib/quote-v2.ts
 *  MaintenanceTierSnapshot) so later catalog edits never change a quote
 *  already built/sent. */
export function useMaintenanceTiers(type: QuoteType) {
  return useQuery({
    queryKey: ["quote-maintenance-tiers", type],
    queryFn: async (): Promise<QuoteMaintenanceTierRow[]> => {
      const { data, error } = await supabase
        .from("quote_maintenance_tiers")
        .select("*")
        .eq("type", type)
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuoteMaintenanceTierRow[];
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

/** Reads the `quote_defaults` row for one quote `type` (unique per type) and
 *  maps it to the v2 content-defaults shape. Falls back to
 *  FALLBACK_QUOTE_DEFAULTS (id: null) when that type has no row yet. Shared
 *  by the hook below and by `createQuoteV2`, which needs the same data
 *  outside a component. */
export async function fetchQuoteDefaultsContent(
  type: QuoteType
): Promise<QuoteDefaultsContent & { id: string | null; type: QuoteType }> {
  const { data, error } = await supabase.from("quote_defaults").select("*").eq("type", type).maybeSingle();
  if (error) throw error;
  const row = data as QuoteDefaultsRow | null;
  if (!row) return { id: null, type, ...FALLBACK_QUOTE_DEFAULTS };
  return {
    id: row.id,
    type: row.type,
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

/** The studio-wide quote boilerplate for one quote `type`
 *  (differentiators/phases/bonuses/next steps/FAQ/legal/payment/testimonial/
 *  validity), admin-edited once per type and reused by every new quote of
 *  that type via `createQuoteV2`. */
export function useQuoteDefaultsV2(type: QuoteType) {
  return useQuery({
    queryKey: ["quote-defaults-v2", type],
    queryFn: () => fetchQuoteDefaultsContent(type),
  });
}

/** Admin: upsert the `quote_defaults` row for one type. `type` is unique on
 *  the table, so this always writes (and only ever writes) the row for
 *  `input.type` , inserting it the first time that type is edited, updating
 *  it every time after. */
export function useSaveQuoteDefaultsV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: QuoteDefaultsContent & { type: QuoteType; id?: string | null }
    ): Promise<string> => {
      const payload = {
        type: input.type,
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
      const { data, error } = await supabase
        .from("quote_defaults")
        .upsert(payload, { onConflict: "type" })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["quote-defaults-v2", vars.type] });
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
  const defaults = await fetchQuoteDefaultsContent(type);
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
      title?: string;
      client_name?: string | null;
      client_business?: string | null;
    }): Promise<void> => {
      const payload: Partial<PriceQuote> = {
        type: input.type,
        subtype: input.subtype,
        content: input.content as unknown as Record<string, unknown>,
        anchor_value: input.anchor,
        final_price: input.content.final_price,
        updated_at: new Date().toISOString(),
      };
      if (input.title !== undefined) payload.title = input.title;
      if (input.client_name !== undefined) payload.client_name = input.client_name;
      if (input.client_business !== undefined) payload.client_business = input.client_business;
      const { error } = await supabase.from("price_quotes").update(payload).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["quote-v2", vars.id] });
      qc.invalidateQueries({ queryKey: ["quotes-v2"] });
    },
  });
}

// ---- send / delete (list actions) ------------------------------------------

/** Marks a draft quote as sent (only draft , sent is allowed; the DB row's
 *  `status`/`sent_at` are the source of truth for "can this still be edited /
 *  can it be deleted"). Used by the quotes list and the open builder's action
 *  bar (see pages/admin/quote/QuoteBuilder.tsx). */
export function useMarkQuoteSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("price_quotes")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["quote-v2", id] });
      qc.invalidateQueries({ queryKey: ["quotes-v2"] });
    },
  });
}

/** Deletes a quote row outright. Callers must keep signed quotes out of reach
 *  (binding record) , this hook itself does not re-check status. */
export function useDeleteQuoteV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("price_quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes-v2"] });
    },
  });
}
