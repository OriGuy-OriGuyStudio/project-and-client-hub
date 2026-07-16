# Quote v2 , Plan 4: AI layer (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The 4 AI assists Ori approved (spec 2026-07-15 §9), inside the admin quote builder: price recommendation, narrative copy in Ori's voice, scope auto-fill from a discovery summary, and upsell suggestions , all via Gemini through the existing `generate-deliverable` edge function with a new `quote_ai` mode. The mechanical engine stays the source of truth; AI failures degrade gracefully.

**Architecture:** One new mode `quote_ai` with an `action` field (`price` | `copy` | `scope_fill` | `upsells`) in `supabase/functions/generate-deliverable/index.ts` (existing Gemini REST pattern: model-fallback list, responseSchema JSON, admin-JWT gate). Client wrapper `src/lib/quote-ai.ts` + builder UI hooks. The discovery summary is stored in `content.notes` , **already stripped from the public RPC** (`content - 'notes'` in `get_quote_public`), so it never leaks to clients.

**Tech Stack:** Supabase Edge Functions (Deno, deployed via CLI `npx supabase functions deploy generate-deliverable --project-ref dbchappsqcsixxecxzqv` , branch only), Gemini REST, React + TS.

## Global Constraints
- Branch `staging`; no push; NO "Co-Authored-By"; NO em-dashes ("—") anywhere incl. AI prompt instructions AND the model is told to never output em-dashes; Hebrew outputs; Ori's voice rules embedded in prompts (first person singular, simple words, no agency buzzwords); admin-only (the fn's existing role gate); AI never bypasses the engine , prices/ids returned by AI are SUGGESTIONS the admin applies; unknown catalog ids from the model are silently dropped (mechanical fallback); `npm run build` + `npm test -- --run` green.
- The controller deploys the fn via CLI and verifies an unauthorized probe (401/403). Real-AI QA = Ori (admin OAuth unavailable headless).

---

### Task 1: Edge function , `quote_ai` mode (4 actions)

**Files:** Modify `supabase/functions/generate-deliverable/index.ts`.

**Interfaces (body → response, all responses `{ ok: true, data } | { ok: false, error }`):**
- `{ mode: "quote_ai", action: "price", payload: { type, subtype?, client_business?, scope: {label, value}[], anchor, options: {fair, recommended, premium}, floor, notes? } }` → `data: { fair: {price, rationale}, recommended: {price, rationale}, premium: {price, rationale}, advice }` , prices integers ₪ ex-VAT; prompt: premium Israeli solo studio, never below floor, engine options given as baseline to refine; rationales are client-usable Hebrew one-liners; `advice` = 2-3 sentences to Ori on how to present the price.
- `action: "copy"`, payload `{ type, subtype?, client_name?, client_business?, scope_labels: string[], notes? }` → `data: { narrative }` , 2-4 sentences, Ori's voice (rules in prompt: first person, warm-simple, no buzzwords, no em-dash, no exclamation marks).
- `action: "scope_fill"`, payload `{ type, catalog: {id, kind, label, desc?}[], notes }` → `data: { subtype_id?, item_ids: string[], reasoning }` , the model picks ONLY ids that exist in the given catalog.
- `action: "upsells"`, payload `{ upsells: {id, label, desc?}[], scope_labels: string[], client_business?, notes? }` → `data: { picks: {id, reason}[] }`.
- Gemini call helper mirrors the existing per-mode functions (model fallback list, responseSchema with Gemini types, temperature modest). maxOutputTokens generous for scope_fill (the catalog is big).

- [ ] **Step 1:** Implement the 4 actions + dispatch (`mode === "quote_ai"` added to the allowed-modes list) following the file's existing conventions exactly.
- [ ] **Step 2:** `npm run build` (app unaffected) , the fn is Deno; sanity-check with `deno check` if available, else careful review.
- [ ] **Step 3 (controller):** deploy via CLI to the branch ref; `curl` probe without auth → 401.
- [ ] **Step 4:** Commit `feat(quote): quote_ai edge mode (price/copy/scope-fill/upsells)`.

### Task 2: Client wrapper + notes field

**Files:** Create `src/lib/quote-ai.ts`; modify `src/lib/quote-v2.ts` (`QuoteContentV2.notes?: string`, kept through emptyQuoteV2 as undefined).

**Interfaces:** `quoteAiPrice(payload)`, `quoteAiCopy(payload)`, `quoteAiScopeFill(payload)`, `quoteAiUpsells(payload)` , each invokes `generate-deliverable` with `{mode:"quote_ai", action, payload}`, throws Hebrew errors on failure; `scope_fill`/`upsells` results are FILTERED against the provided catalogs (drop unknown ids) before returning , the mechanical fallback lives here.

- [ ] **Step 1:** Implement (mirror `src/lib/deliverables.ts` invoke pattern). Add `notes` to the content type (admin-only field; confirm `get_quote_public` strips it , it does: `content - 'notes'`).
- [ ] **Step 2:** Tests: a small unit test for the id-filtering fallback (pure function extracted, e.g. `filterAiIds(ids, catalog)`). Build+tests green.
- [ ] **Step 3:** Commit `feat(quote): quote-ai client wrappers + admin notes field`.

### Task 3: Builder , pricing assist UI

**Files:** Modify `src/pages/admin/quote/PricePanel.tsx` (+ QuoteBuilder wiring for client fields).

- [ ] **Step 1:** Enable the "עזור לי לתמחר עם AI" button: onClick → `quoteAiPrice` with the live payload (type/subtype/client_business/scope/anchor/current options/floor/notes). Pending state ("חושב…"). On success render an AI result card under the options: the 3 AI prices with rationales, each with "בחר" (applies via `onSetFinal`), + the `advice` text in muted. On error , Hebrew toast, panel unchanged.
- [ ] **Step 2:** Build green. Commit `feat(quote): AI pricing assist in the builder`.

### Task 4: Builder , discovery notes, scope-fill, narrative, upsell suggestions

**Files:** Modify `src/pages/admin/quote/QuoteBuilder.tsx` (setup tab), `QuoteContentEditorsV2.tsx` (narrative + upsells areas).

- [ ] **Step 1:** Setup tab: "סיכום אפיון (פנימי, לא מוצג ללקוח)" Textarea bound to `content.notes`. Under it two buttons: **"מלא היקף עם AI"** (→ `quoteAiScopeFill` with the type's catalog; applies subtype + adds suggested items to scope additively/deduped via the existing handlers; toast "נוספו X פריטים"; disabled when notes empty) and nothing else.
- [ ] **Step 2:** Proposal tab narrative editor gets **"נסח עם AI"** (→ `quoteAiCopy`, fills the narrative field, editable after; pending state).
- [ ] **Step 3:** Addons tab upsell picker gets **"הצע תוספות עם AI"** (→ `quoteAiUpsells` with the type-scoped upsell catalog; auto-selects the picked upsells as snapshots + toast with the reasons; disabled when notes empty).
- [ ] **Step 4:** All disabled when quote locked. Build green. Commit `feat(quote): AI scope-fill, narrative and upsell suggestions in the builder`.

### Task 5: Review + controller verification

- [ ] Whole-plan review (per-task reviews as usual). Controller: deploy check (401 probe), grep no em-dash in prompts, verify notes never rendered on the public page, Ori QA list for the real AI calls.

## Self-review notes
- The public page never reads `notes` (grep as part of Task 5).
- AI applies through existing handlers only (setScope/selectSubtype/onSetFinal/upsell snapshot) , no new mutation paths.
- If Gemini quota/key fails, every button toasts and the manual flow is untouched.
