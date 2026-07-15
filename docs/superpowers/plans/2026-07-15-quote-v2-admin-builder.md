# Quote System v2 , Plan 2: Admin builder (the calculator)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The admin-facing quote builder: pick type/subtype, assemble scope from separated catalogs, get a live anchor + 3 priced options (with rationale + manual override + soft-floor warning), edit all client-facing content, and save/send , consuming the tested `quote-pricing` engine from Plan 1.

**Architecture:** New `src/lib/quote-v2.ts` (content type + defaults + thin display helpers over `quote-pricing`), new hooks in `src/hooks/useQuotesV2.ts`, new admin pages under `src/pages/admin/quote/`. Data snapshot lives in `price_quotes.content`; catalog + multipliers are seed/config only. Browser-verified (the pricing math is already unit-tested in Plan 1).

**Tech Stack:** React 18 + TS + Vite + Tailwind, TanStack Query, Supabase (branch `dbchappsqcsixxecxzqv` via MCP), Vitest for any new pure logic.

**Reference:** spec `docs/superpowers/specs/2026-07-15-quote-system-v2-design.md` (§2, §5-8, §10, §13); Plan 1 delivered `src/lib/quote-pricing.ts` (anchorValue, priceOptions, belowFloor, breakdownForFinal, withVat, vatOf, paymentSplit, shekel) + the v2 schema/RPCs.

## Global Constraints

- Branch `staging` only; never push to `main` without Ori's approval. No "Co-Authored-By" trailer. No em-dashes ("—").
- Hebrew UI throughout; gendered copy where the UI addresses a user.
- Money base is ex-VAT; VAT shown small. `content` is a per-quote snapshot; editing a quote never writes to `quote_catalog`.
- Floor is a soft warning: the 3 auto options are floor-protected (never below floor); a manual override below floor shows a warning but is allowed (Ori-confirmed).
- Multipliers + floor are per-type (from `quote_type_multipliers`).
- Keep `npm run build` and `npm test` green after every task.
- The AI "help me price" button is a visible placeholder in this plan (disabled or a toast "בקרוב"); it is wired for real in Plan 4.

---

### Task 1: quote_catalog `type` column + v2 catalog seed

**Files:** Create `supabase/migrations/20260715140000_quote_catalog_v2.sql`. Verify via MCP.

**Interfaces:** Produces `quote_catalog.type` (`website|system|automation`, nullable for universal upsells), and seeded catalog rows per type: website subtypes/pages/features, system modules, automation complexity levels. Each row: `kind`, `type`, `label`, `value` (in `base_price`), `recommended`, `sort`.

- [ ] **Step 1: Write the migration**

```sql
alter table public.quote_catalog
  add column if not exists type text
    check (type is null or type in ('website','system','automation'));

-- start clean for v2 seed (dev branch only; catalog is config, not user data)
delete from public.quote_catalog where kind in ('subtype','page','feature','module','automation');

insert into public.quote_catalog (kind, type, site_type, label, base_price, default_mult, sort) values
  ('subtype','website',null,'דף נחיתה',2500,1,10),
  ('subtype','website',null,'אתר תדמית',4000,1,20),
  ('subtype','website',null,'חנות',6000,1,30),
  ('subtype','website',null,'קטלוג',4500,1,40),
  ('subtype','website',null,'אתר תוכן / מגזין',4000,1,50),
  ('subtype','website',null,'אתר אירוע',3500,1,60),
  ('subtype','website',null,'מיקרו-סייט קמפיין',3000,1,70),
  ('subtype','website',null,'אתר חד-עמודי',2500,1,80),
  ('page','website',null,'עמוד בית',2500,1,100),
  ('page','website',null,'אודות',1200,1,110),
  ('page','website',null,'שירותים',1500,1,120),
  ('page','website',null,'עמוד שירות בודד',1000,1,130),
  ('page','website',null,'גלריה / פורטפוליו',2000,1,140),
  ('page','website',null,'עמוד פרויקט בודד',1200,1,150),
  ('page','website',null,'בלוג',1800,1,160),
  ('page','website',null,'צור קשר',1200,1,170),
  ('page','website',null,'שאלות נפוצות',800,1,180),
  ('page','website',null,'מחירון',1000,1,190),
  ('page','website',null,'עמוד מוצר',1800,1,200),
  ('page','website',null,'קטגוריה',1200,1,210),
  ('page','website',null,'סל ותשלום',2500,1,220),
  ('page','website',null,'עמוד תודה',400,1,230),
  ('feature','website',null,'מערכת ניהול תוכן',1500,1,300),
  ('feature','website',null,'טפסים מתקדמים',1000,1,310),
  ('feature','website',null,'רב-לשוני',1800,1,320),
  ('feature','website',null,'אזור אישי / התחברות',2500,1,330),
  ('feature','website',null,'סליקה ותשלום',2000,1,340),
  ('feature','website',null,'תיאום פגישות',1800,1,350),
  ('feature','website',null,'חיפוש ופילטרים',1200,1,360),
  ('feature','website',null,'אנימציות מתקדמות',1500,1,370),
  ('feature','website',null,'אינטגרציית CRM / וואטסאפ',1200,1,380),
  ('feature','website',null,'הקמת ניוזלטר',800,1,390),
  ('feature','website',null,'נגישות מלאה',1000,1,400),
  ('feature','website',null,'SEO טכני מוטמע',800,1,410),
  ('module','system',null,'דשבורד ניהול',4000,1,500),
  ('module','system',null,'ניהול משתמשים והרשאות',3000,1,510),
  ('module','system',null,'אימות והרשמה',1500,1,520),
  ('module','system',null,'דוחות ואנליטיקס',2500,1,530),
  ('module','system',null,'התראות ומיילים',1200,1,540),
  ('module','system',null,'תשלומים ומנויים',3000,1,550),
  ('module','system',null,'אינטגרציית API חיצוני',2500,1,560),
  ('module','system',null,'ייבוא וייצוא נתונים',1200,1,570),
  ('module','system',null,'לוח שנה ותזמון',2000,1,580),
  ('module','system',null,'צ׳אט ומסרים',2500,1,590),
  ('module','system',null,'חיפוש מתקדם',1500,1,600),
  ('module','system',null,'אפליקציית מובייל / PWA',2500,1,610),
  ('module','system',null,'אוטומציות פנימיות',2000,1,620),
  ('automation','automation',null,'בסיס הקמה ושילוב',1000,1,700),
  ('automation','automation',null,'אוטומציה פשוטה',800,1,710),
  ('automation','automation',null,'אוטומציה בינונית',1500,1,720),
  ('automation','automation',null,'אוטומציה מורכבת',2800,1,730);
```

- [ ] **Step 2:** Apply via MCP `apply_migration` (name `quote_catalog_v2`). Expect success.
- [ ] **Step 3:** Verify via `execute_sql`: counts per (kind,type) match (website: 8 subtype + 14 page + 13 feature; system: 13 module; automation: 4 automation); `type` column exists; the 3 existing upsell rows untouched.
- [ ] **Step 4:** Commit the migration file (`feat(quote): v2 catalog (type column + per-type seed)`).

---

### Task 2: v2 content type + display helpers (pure, tested)

**Files:** Create `src/lib/quote-v2.ts`, `src/lib/quote-v2.test.ts`. Modify `src/types/database.ts` (v2 row + catalog + multipliers types; drop stale v1 RPC shapes).

**Interfaces:** Produces `QuoteContentV2` (type, subtype, scope items separated, final_price, show_breakdown, upsells[], maintenance, bonuses[], narrative, phases[], testimonial, faq[], legal[], payment, vat_pct, differentiators[], next_steps[]); `emptyQuoteV2(defaults)`; `quoteTotals(content, selected, multipliers, floor, monthlyFor)` returning `{ anchor, options, chosen, upsellsTotal, discount, net, vat, total, split, breakdown }` by composing `quote-pricing`.

- [ ] **Step 1:** Write failing tests for `quoteTotals` (anchor from items, options match priceOptions, total = withVat(net), breakdown sums to final, selected upsells add to net).
- [ ] **Step 2:** Run `npm test`, see fail.
- [ ] **Step 3:** Implement `quote-v2.ts` composing the Plan 1 `quote-pricing` functions; add the v2 types to `database.ts`.
- [ ] **Step 4:** `npm test` pass + `npm run build` green.
- [ ] **Step 5:** Commit (`feat(quote): v2 content type + display helpers (tested)`).

---

### Task 3: v2 hooks (catalog, multipliers, quotes, defaults)

**Files:** Create `src/hooks/useQuotesV2.ts`.

**Interfaces:** `useQuoteCatalog()` (grouped by kind/type), `useQuoteMultipliers()` (per-type map), `useQuotesV2()` (list), `useQuoteV2(id)`, `useQuoteDefaultsV2()`, `useSaveQuoteDefaultsV2()`, plus a `createQuoteV2(type)` insert. Mutations invalidate their queries.

- [ ] **Step 1:** Implement the hooks (Supabase reads/writes; TanStack Query). No new pure logic to unit-test; correctness verified when consumed in Task 4+.
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3:** Commit (`feat(quote): v2 data hooks`).

---

### Task 4: Builder shell , type/subtype + scope + live anchor

**Files:** Create `src/pages/admin/quote/QuoteBuilder.tsx` (+ small subcomponents under `src/pages/admin/quote/`). Modify `src/App.tsx` (route `/admin/tools/quote`), `src/pages/admin/Tools.tsx` (re-enable card, `ready:true`).

**Build (per spec §8, dark admin, brand tokens):** type tabs (אתר/מערכת/אוטומציה); website subtype chips; separated scope sections (עמודים / פיצ'רים for website; מודולים for system; אוטומציות for automation) with toggle + per-line editable value; live **anchor** panel. New quote via "הצעה חדשה". Locks when status=signed.

- [ ] **Step 1:** Implement the shell + scope selection + live anchor, wired to hooks + `quoteTotals`.
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3:** Browser-verify (dev server): open `/admin/tools/quote`, create a website quote, toggle pages/features, confirm anchor updates and pages vs features are separated. Report DOM/console evidence.
- [ ] **Step 4:** Commit (`feat(quote): v2 builder shell (type/subtype/scope/anchor)`).

---

### Task 5: Pricing panel , 3 options + override + soft floor + AI placeholder

**Files:** Create `src/pages/admin/quote/PricePanel.tsx`.

**Build:** the 3 option cards (הוגן/מומלץ/פרימיום) with price + rationale from `quoteTotals.options`, "מומלץ" highlighted; select one sets `final_price`; a manual override input; if override `belowFloor`, show a soft warning (not a block); a disabled "עזור לי לתמחר עם AI" button with a "בקרוב" note.

- [ ] **Step 1:** Implement, wired to `quoteTotals` + `quote_type_multipliers`.
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3:** Browser-verify: options show correct numbers + rationale; picking sets final; manual value under floor shows the warning and still saves; AI button visible+disabled.
- [ ] **Step 4:** Commit (`feat(quote): v2 price options + override + soft floor`).

---

### Task 6: Content editors + breakdown toggle

**Files:** Create `src/pages/admin/quote/QuoteContentEditorsV2.tsx`; Create `src/pages/admin/quote/QuoteDefaultsV2.tsx` + route.

**Build (reuse the v1 editor patterns, adapted):** editors for narrative, differentiators, phases, bonuses, upsells (with `recommended` toggle), maintenance offer/tiers, next_steps, faq, legal, testimonial, payment (deposit %/terms), discount, validity, vat, and the **"הצג פירוט מחיר ללקוח"** toggle. Studio defaults page seeds new quotes.

- [ ] **Step 1:** Implement the editors + defaults page + route.
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3:** Browser-verify: edit each section, toggle show-breakdown, save, reload, values persist.
- [ ] **Step 4:** Commit (`feat(quote): v2 content editors + breakdown toggle`).

---

### Task 7: List + save/send + copy link

**Files:** Modify `src/pages/admin/quote/QuoteBuilder.tsx` (list view + actions).

**Build:** quotes list (status badge, type, final price); save; mark sent (sets `sent_at`, status `sent`); copy client link (`/quote/:share_token`); delete; lock on signed. The client page itself is Plan 3 , the link will 404 until then (note in the UI).

- [ ] **Step 1:** Implement list + actions.
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3:** Browser-verify: create, save, mark sent, copy link, delete; list reflects state.
- [ ] **Step 4:** Commit (`feat(quote): v2 quote list + save/send/link`).

---

## Self-review notes
- Spec coverage: §8 builder (Tasks 4-7), §2 pricing consumed (Task 2/5), §5-6 upsells/maintenance editors (Task 6), §10 catalog `type` + §13 reviewer gap (Task 1), show-breakdown toggle §7.3 (Task 6). AI real wiring , Plan 4. Client page , Plan 3.
- Reviewer carryover resolved: Task 1 adds `quote_catalog.type`; `database.ts` v1 RPC shapes dropped in Task 2.
- UI tasks are browser-verified; only new pure logic (`quote-v2` totals) is unit-tested.

## Roadmap after this plan
- **Plan 3 , v2 client page** (direction ג, Ori's voice, breakdown toggle, expired state, viewed tracking, sign+IP from headers).
- **Plan 4 , AI layer** (pricing/copy/scope-fill/upsells, mechanical fallback).
- **Plan 5 , maintenance tiers (system/automation), PDF, ship to prod.**
