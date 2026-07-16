// Quote system v2 , public (token-scoped) data hooks for the client-facing
// quote page. Pure Supabase integration; pricing math stays in
// lib/quote-pricing.ts + lib/quote-v2.ts. See spec 2026-07-15-quote-system-v2-design.md
// and docs/superpowers/plans/2026-07-16-quote-v2-plan3-client-page.md (Task 3).

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { QuoteContentV2, QuoteSelected } from "@/lib/quote-v2";
import type { QuoteType } from "@/lib/quote-pricing";
import type { PriceQuote } from "@/types/database";

/** The shape `get_quote_public` returns , a token-scoped, read-only
 *  projection of a price_quote row (never exposes the anchor or multipliers,
 *  only the admin-approved content snapshot). */
export type QuotePublic = {
  id: string;
  title: string;
  client_name: string | null;
  client_business: string | null;
  type: QuoteType;
  subtype: string | null;
  status: PriceQuote["status"];
  final_price: number;
  content: QuoteContentV2;
  selected: QuoteSelected | Record<string, never>;
  signed_name: string | null;
  signed_at: string | null;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  org_name: string | null;
};

/** Fetches the public quote snapshot by share token. `null` data means the
 *  token doesn't match any quote (bad/expired link) , the page renders its
 *  not-found state, never an error toast (a bad token is an expected case,
 *  not a failure). */
export function useQuotePublic(token: string | undefined) {
  return useQuery({
    queryKey: ["quote-public", token],
    enabled: !!token,
    queryFn: async (): Promise<QuotePublic | null> => {
      const { data, error } = await supabase.rpc("get_quote_public", { p_token: token! });
      if (error) throw error;
      return (data as QuotePublic | null) ?? null;
    },
  });
}

/** Stamps `viewed_at` once, the first time the client opens a sent/draft
 *  quote. Fire-and-forget from the page , a failure here should never block
 *  or degrade the read experience, so callers swallow the error. */
export function useMarkQuoteViewed() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase.rpc("mark_quote_viewed", { p_token: token });
      if (error) throw error;
    },
  });
}

/** Records the client's signature + final selection. IP is captured
 *  server-side by the RPC (migration 20260716160000); `p_ip` stays for
 *  back-compat only and is always sent as null from here. */
export function useSignQuote() {
  return useMutation({
    mutationFn: async (args: {
      token: string;
      name: string;
      signatureImage: string;
      selected: QuoteSelected;
    }) => {
      const { data, error } = await supabase.rpc("sign_quote", {
        p_token: args.token,
        p_name: args.name,
        p_signature_image: args.signatureImage,
        p_selected: args.selected as unknown as Record<string, unknown>,
        p_ip: null,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? "החתימה נכשלה");
      return result;
    },
  });
}

/** A quote is expired ONLY when it was actually sent (`status === 'sent'`)
 *  and `validity_days` have elapsed since `sent_at` (fallback `created_at`
 *  for older rows). Drafts never expire , the admin previews them
 *  indefinitely before sending. Signed/declined quotes aren't "expired",
 *  they're resolved , the page shows those states instead, so this only
 *  needs to answer the question for a live (draft/sent) quote. */
export function quoteExpiry(q: Pick<QuotePublic, "status" | "sent_at" | "created_at" | "content">): {
  expired: boolean;
  expiresAt: Date | null;
} {
  if (q.status !== "sent") return { expired: false, expiresAt: null };
  const base = q.sent_at ?? q.created_at;
  if (!base) return { expired: false, expiresAt: null };
  const validityDays = Number(q.content?.validity_days) || 0;
  if (validityDays <= 0) return { expired: false, expiresAt: null };
  const expiresAt = new Date(new Date(base).getTime() + validityDays * 86_400_000);
  return { expired: Date.now() > expiresAt.getTime(), expiresAt };
}
