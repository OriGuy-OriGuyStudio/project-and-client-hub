export type QuoteType = "website" | "system" | "automation";
export type WebsiteSubtype =
  | "landing" | "portfolio" | "store" | "catalog" | "content" | "event" | "campaign" | "onepage";
export type ScopeItemKind = "subtype" | "page" | "feature" | "module" | "automation";

export type ScopeItem = { id: string; kind: ScopeItemKind; label: string; value: number };
export type QuoteScope = { type: QuoteType; subtype?: WebsiteSubtype; items: ScopeItem[] };

export function anchorValue(scope: QuoteScope): number {
  return (scope.items ?? []).reduce((sum, it) => sum + (Number(it.value) || 0), 0);
}
