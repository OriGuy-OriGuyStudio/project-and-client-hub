// Quote v2 , AI-assist client wrappers (`quote_ai` edge mode, 5 actions).
// The mechanical pricing engine (./quote-pricing, ./quote-v2) stays the source
// of truth , these are suggestions the admin reviews and applies through the
// existing handlers. Ids the model returns are validated against the catalog
// passed to it; anything unknown or duplicate is silently dropped here before
// it can reach the builder. See docs/superpowers/plans/2026-07-16-quote-v2-plan4-ai-layer.md.

import { supabase } from "./supabase";
import { fnErrorMessage } from "./invite";
import type { QuoteType, ScopeItemKind } from "./quote-pricing";

/** The scope kinds the AI is allowed to propose for each quote type. Anything
 *  else the model returns is dropped , the client picks the kind, not the AI. */
const PROPOSABLE_KINDS: Record<QuoteType, ScopeItemKind[]> = {
  website: ["page", "feature"],
  system: ["module"],
  automation: ["automation"],
};

/** Logs the underlying failure for devtools and throws a fixed, Hebrew,
 *  action-specific message , the UI toast never leaks a raw/English error. */
function aiFail(action: string, fallback: string, e: unknown): never {
  // eslint-disable-next-line no-console
  console.error(`[quote-ai] ${action} failed:`, e);
  throw new Error(fallback);
}

/** Drops ids that aren't in `validIds` and de-duplicates, preserving the
 *  first-seen order of `ids`. Pure function , this is the mechanical fallback
 *  that keeps AI-hallucinated ids out of the builder. */
export function filterAiIds(ids: string[], validIds: Set<string> | string[]): string[] {
  const valid = validIds instanceof Set ? validIds : new Set(validIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids ?? []) {
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// action: price

export type QuoteAiPricePayload = {
  type: QuoteType;
  subtype?: string;
  client_business?: string;
  scope: { label: string; value: number }[];
  anchor: number;
  options: { fair: number; recommended: number; premium: number };
  floor: number;
  notes?: string;
};

export type QuoteAiPriceOption = { price: number; rationale: string };
export type QuoteAiPriceResult = {
  fair: QuoteAiPriceOption;
  recommended: QuoteAiPriceOption;
  premium: QuoteAiPriceOption;
  advice: string;
};

export async function quoteAiPrice(payload: QuoteAiPricePayload): Promise<QuoteAiPriceResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "quote_ai", action: "price", payload },
    });
    if (error) throw new Error(await fnErrorMessage(error));
    if (data && data.ok === false) throw new Error(data.error || "generation failed");
    return data?.data as QuoteAiPriceResult;
  } catch (e) {
    return aiFail("price", "ה-AI לא הצליח להציע מחיר, נסה שוב.", e);
  }
}

// ---------------------------------------------------------------------------
// action: copy

export type QuoteAiCopyPayload = {
  type: QuoteType;
  subtype?: string;
  client_name?: string;
  client_business?: string;
  scope_labels: string[];
  notes?: string;
};

export type QuoteAiCopyResult = { narrative: string };

export async function quoteAiCopy(payload: QuoteAiCopyPayload): Promise<QuoteAiCopyResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "quote_ai", action: "copy", payload },
    });
    if (error) throw new Error(await fnErrorMessage(error));
    if (data && data.ok === false) throw new Error(data.error || "generation failed");
    return data?.data as QuoteAiCopyResult;
  } catch (e) {
    return aiFail("copy", "ה-AI לא הצליח לנסח את הטקסט, נסה שוב.", e);
  }
}

// ---------------------------------------------------------------------------
// action: scope_fill

export type QuoteAiCatalogEntry = { id: string; kind: string; label: string; desc?: string };

export type QuoteAiScopeFillPayload = {
  type: QuoteType;
  catalog: QuoteAiCatalogEntry[];
  notes: string;
};

export type QuoteAiScopeFillResult = {
  subtype_id?: string;
  item_ids: string[];
  reasoning: string;
};

export async function quoteAiScopeFill(payload: QuoteAiScopeFillPayload): Promise<QuoteAiScopeFillResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "quote_ai", action: "scope_fill", payload },
    });
    if (error) throw new Error(await fnErrorMessage(error));
    if (data && data.ok === false) throw new Error(data.error || "generation failed");
    const raw = (data?.data ?? {}) as QuoteAiScopeFillResult;
    const validIds = new Set(payload.catalog.map((c) => c.id));
    const subtype_id = raw.subtype_id && validIds.has(raw.subtype_id) ? raw.subtype_id : undefined;
    return {
      subtype_id,
      item_ids: filterAiIds(raw.item_ids ?? [], validIds),
      reasoning: raw.reasoning ?? "",
    };
  } catch (e) {
    return aiFail("scope_fill", "ה-AI לא הצליח למלא את ההיקף, נסה שוב.", e);
  }
}

// ---------------------------------------------------------------------------
// action: upsells

export type QuoteAiUpsellCatalogEntry = { id: string; label: string; desc?: string };

export type QuoteAiUpsellsPayload = {
  upsells: QuoteAiUpsellCatalogEntry[];
  scope_labels: string[];
  client_business?: string;
  notes?: string;
};

export type QuoteAiUpsellPick = { id: string; reason: string };
export type QuoteAiUpsellsResult = { picks: QuoteAiUpsellPick[] };

export async function quoteAiUpsells(payload: QuoteAiUpsellsPayload): Promise<QuoteAiUpsellsResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "quote_ai", action: "upsells", payload },
    });
    if (error) throw new Error(await fnErrorMessage(error));
    if (data && data.ok === false) throw new Error(data.error || "generation failed");
    const raw = (data?.data ?? {}) as QuoteAiUpsellsResult;
    const validIds = new Set(payload.upsells.map((u) => u.id));
    const filteredIds = filterAiIds((raw.picks ?? []).map((p) => p.id), validIds);
    const byId = new Map((raw.picks ?? []).map((p) => [p.id, p]));
    const picks = filteredIds.map((id) => byId.get(id)!).filter(Boolean);
    return { picks };
  } catch (e) {
    return aiFail("upsells", "ה-AI לא הצליח להציע תוספות, נסה שוב.", e);
  }
}

// ---------------------------------------------------------------------------
// action: order , reorder existing scope items into the logical sequence they'd
// appear on the deliverable. Never adds/removes: the result is guaranteed to be
// a permutation of the input ids (AI-omitted ids are appended in original order,
// unknown ids dropped), so the builder can apply it without losing a single item.

export type QuoteAiOrderItem = { id: string; kind: string; label: string; desc?: string };

export type QuoteAiOrderPayload = {
  type: QuoteType;
  items: QuoteAiOrderItem[];
  notes?: string;
};

export type QuoteAiOrderResult = { ordered_ids: string[]; reasoning: string };

export async function quoteAiOrder(payload: QuoteAiOrderPayload): Promise<QuoteAiOrderResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "quote_ai", action: "order", payload },
    });
    if (error) throw new Error(await fnErrorMessage(error));
    if (data && data.ok === false) throw new Error(data.error || "generation failed");
    const raw = (data?.data ?? {}) as QuoteAiOrderResult;
    const inputIds = payload.items.map((i) => i.id);
    const validIds = new Set(inputIds);
    // The AI's order, minus hallucinated/duplicate ids...
    const fromAi = filterAiIds(raw.ordered_ids ?? [], validIds);
    // ...then every input id it forgot, appended in the original order, so the
    // result is always a full permutation , no item silently disappears.
    const seen = new Set(fromAi);
    const ordered_ids = [...fromAi, ...inputIds.filter((id) => !seen.has(id))];
    return { ordered_ids, reasoning: raw.reasoning ?? "" };
  } catch (e) {
    return aiFail("order", "ה-AI לא הצליח לסדר את הפריטים, נסה שוב.", e);
  }
}

// ---------------------------------------------------------------------------
// action: propose , brand-new pages/features from the model's own knowledge (NOT
// the catalog), returned as suggestions the admin adds as editable custom items.
// No id involved here (the builder assigns fresh ids), so the guardrails are:
// kind must be valid for the type, label non-empty, value a non-negative number.

export type QuoteAiProposePayload = {
  type: QuoteType;
  notes?: string;
  client_business?: string;
  existing_labels?: string[];
};

export type QuoteAiProposedItem = { kind: ScopeItemKind; label: string; desc?: string; value: number };
export type QuoteAiProposeResult = { items: QuoteAiProposedItem[]; reasoning: string };

export async function quoteAiPropose(payload: QuoteAiProposePayload): Promise<QuoteAiProposeResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "quote_ai", action: "propose", payload },
    });
    if (error) throw new Error(await fnErrorMessage(error));
    if (data && data.ok === false) throw new Error(data.error || "generation failed");
    const raw = (data?.data ?? {}) as { items?: unknown; reasoning?: string };
    const allowed = new Set<ScopeItemKind>(PROPOSABLE_KINDS[payload.type] ?? []);
    const items: QuoteAiProposedItem[] = (Array.isArray(raw.items) ? raw.items : [])
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const kind = String(o.kind ?? "") as ScopeItemKind;
        const label = String(o.label ?? "").trim();
        const desc = String(o.desc ?? "").trim();
        const value = Math.max(0, Math.round(Number(o.value) || 0));
        return { kind, label, desc: desc || undefined, value };
      })
      .filter((it) => allowed.has(it.kind) && it.label.length > 0)
      .slice(0, 12);
    return { items, reasoning: raw.reasoning ?? "" };
  } catch (e) {
    return aiFail("propose", "ה-AI לא הצליח להציע פריטים חדשים, נסה שוב.", e);
  }
}
