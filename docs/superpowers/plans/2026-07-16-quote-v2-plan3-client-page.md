# Quote v2 , Plan 3: Client-facing quote page (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The public page a client opens from the share link: reads the quote, presents it in direction ג (dark, tabbed/sectioned, Ori's first-person voice), lets the client pick optional extras + a maintenance tier, shows a live total (discount + VAT + payment split), and signs (name + signature) with server-side IP capture. Viewed tracking + expired state.

**Architecture:** Public route `/quote/:token` (no auth, outside AppShell) → `get_quote_public` RPC (token-scoped, exists) → render from the content snapshot; `mark_quote_viewed` on load; `sign_quote` on signature with IP derived server-side from request headers. Client selection = optional scope items + upsells + one maintenance tier, priced by the tested engine (`quoteTotals`).

**Tech Stack:** React + TS, Supabase RPCs (anon), Vitest for engine changes, existing brand tokens (dark), canvas signature (mirror v1's signature pad if in git history), canvas-confetti on signed.

## Global Constraints
- Branch `staging`; no push; NO "Co-Authored-By"; NO em-dashes ("—"); Hebrew RTL; semantic tokens not hex; pricing math ONLY in the engine; the client sees ONE final price (never the admin's 3 options or the anchor); prices ex-VAT with VAT shown קטן (small) per Ori; Ori's simple first-person voice , no agency slogans; **the controller browser-verifies this plan end-to-end via a real share token (public page needs no OAuth)**.
- Snapshot rule: the page renders ONLY the quote's content snapshot (never live catalog).
- Expired = `validity_days` elapsed since `sent_at` (fallback `created_at`): show an expired notice + WhatsApp contact, block signing.

---

### Task 1: Engine , client selection of optional scope items

**Files:** Modify `src/lib/quote-v2.ts`; Test `src/lib/quote-v2.test.ts`.

**Interfaces:** `QuoteSelected` gains `optional_ids: string[]` (ids of chosen optional SCOPE items). `quoteTotals`: `gross = final_price + upsellsTotal + optionalScopeTotal` where `optionalScopeTotal` = sum of `content.scope` items that are `optional` AND in `selected.optional_ids`. Free items never priced. Discount/VAT/split flow unchanged over the new gross.

- [ ] **Step 1: Failing tests** , optional item (1800) selected → total includes it; not selected → excluded; free item never included even if its id appears in optional_ids.
- [ ] **Step 2:** Implement; keep `upsell_ids` behavior unchanged; update all `QuoteSelected` literals in src (builder PricePanel/PriceSummary pass `optional_ids: []`).
- [ ] **Step 3:** `npm test -- --run` green (all suites). Commit `feat(quote): client-selectable optional scope items in totals`.

---

### Task 2: RPC hardening , server-side IP + expiry fields (migration)

**Files:** Create `supabase/migrations/20260716160000_sign_quote_ip_serverside.sql`.

- [ ] **Step 1:** `create or replace function public.sign_quote(...)` same signature (keep `p_ip` for back-compat) but derive the stored IP server-side: `coalesce(nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''), p_ip)`. Also confirm `get_quote_public` returns: title, client_name, client_business, type, subtype, content, status, final_price, sent_at, created_at, validity via content, signed_name, signed_at , add any missing field the page needs (write the replace if so).
- [ ] **Step 2:** Controller applies to the branch + verifies (sign a test token via SQL-simulated anon call is optional; at minimum function compiles + grants intact for anon).
- [ ] **Step 3:** Commit `feat(quote): sign_quote captures IP server-side`.

---

### Task 3: Public page shell , route, data, states

**Files:** Create `src/pages/public/QuoteView.tsx` (+ `src/pages/public/quote/` subcomponents as needed); Modify `src/App.tsx` (public route `/quote/:token`, lazy, OUTSIDE RequireAuth, near RefLanding/ServicePreview pattern); Create `src/hooks/useQuotePublic.ts` (fetch via `supabase.rpc('get_quote_public', {p_token})`, `mark_quote_viewed` once on mount, `sign_quote` mutation).

**Build:** standalone dark page (brand tokens `.dark`, Kaha headings, RTL). States: loading; not-found (404-style, Ori's voice); declined; **expired** (per Global Constraints); signed (green success banner + signature name/date); normal. `mark_quote_viewed` fire-and-forget on load.

- [ ] **Step 1:** Hook + route + shell with the state screens (content sections are placeholders "בבנייה" for now).
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3 (controller):** browser-verify with a real token: page loads, `viewed_at` gets stamped in DB, bad token → not-found.
- [ ] **Step 4:** Commit `feat(quote): public quote page shell (route, states, viewed tracking)`.

---

### Task 4: Presentation sections , hero, included, story

**Files:** Create section components under `src/pages/public/quote/` ; wire into QuoteView.

**Build (direction ג, Ori's voice):** sticky mini-nav (sections); hero (שלום {client_name}, title, narrative, validity note); "מה כלול" , included scope items (incl. free ones) with their descriptions, grouped עמודים/פיצ'רים (or מודולים/אוטומציות by type), breakdown prices shown ONLY when `content.show_breakdown` (free items show "כלול" instead of a price); differentiators ("למה איתי"); phases timeline; bonuses ("מתנות") with values; testimonial; FAQ accordion; next steps; legal (collapsible, numbered).

- [ ] **Step 1:** Implement sections (content from the snapshot only).
- [ ] **Step 2:** Build green; controller browser-verifies each section renders for website/system/automation quotes (per-type content differs).
- [ ] **Step 3:** Commit `feat(quote): client page content sections`.

---

### Task 5: Interactive pricing , extras, maintenance, live total, split

**Files:** Create `src/pages/public/quote/PricingSection.tsx` (+ selection state in QuoteView).

**Build:** optional extras picker (optional scope items + upsells, each with description + price, recommended highlighted); maintenance tier cards (from the snapshot `content.maintenance.tiers`, recommended highlighted, monthly price, "אפשר להוסיף גם אחרי העלייה לאוויר"); **live summary**: final price, + selected extras, − discount (with label), = לפני מע"מ, מע"מ בקטן, סה"כ, payment split (deposit/rest per `content.payment`), monthly maintenance line when selected. All via `quoteTotals(content, selected, ...)` , floor/mult irrelevant on the client (pass defaults; options ignored).

- [ ] **Step 1:** Implement with `QuoteSelected` state (upsell_ids + optional_ids + maintenance_tier).
- [ ] **Step 2:** Build green; controller browser-verifies: toggling extras/tier updates the total live; discount + VAT correct vs the admin summary.
- [ ] **Step 3:** Commit `feat(quote): client page interactive pricing`.

---

### Task 6: Sign flow

**Files:** Create `src/pages/public/quote/SignSection.tsx`. (Check git history for v1's signature pad: `git show b1a5a79~1:src/pages/public/QuotePage.tsx` , reuse its canvas approach.)

**Build:** name Input + signature canvas (clear/undo) + approval checkbox ("קראתי ואני מאשר את ההצעה והתנאים" , gender-neutral phrasing or per client gender unknown → neutral "קראתי ואישרתי"); submit → `sign_quote(p_token, name, dataURL, selected, null)` (IP captured server-side); success → signed state + confetti; errors toasted. Expired/declined/signed quotes never show the form.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Build green; controller browser-verifies a full sign on a test quote: signature stored, status flips to signed, `signed_ip` populated (check DB), admin list shows נחתמה, immutability guard blocks edits.
- [ ] **Step 3:** Commit `feat(quote): client sign flow with server-side IP`.

---

### Task 7: Polish + mobile + copy link cleanup

**Files:** QuoteView + sections; `src/pages/admin/quote/QuoteBuilder.tsx` (remove the "link 404s" toast note , the page exists now).

- [ ] **Step 1:** Mobile pass (sticky summary bar on mobile, sections stack, tap targets); reduced-motion respected; remove the 404 warning from copyQuoteLink; add an "פתח תצוגת לקוח" action in the builder (opens the share URL in a new tab).
- [ ] **Step 2:** Build green; controller browser-verifies mobile viewport (375px) + dark rendering + the full happy path once more.
- [ ] **Step 3:** Commit `feat(quote): client page polish + builder open-preview`.

## Self-review notes
- Client never sees anchor/options/multipliers (Task 5 passes engine defaults; only `total`-family outputs rendered).
- Expiry duplicated nowhere: one helper `quoteExpiry(quote)` in the hook file, used by shell + sign flow.
- `optional_ids` naming consistent across Tasks 1/5/6 (sign_quote persists the whole `selected` jsonb , already generic).
