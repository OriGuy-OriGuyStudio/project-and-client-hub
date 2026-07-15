# Quote System v2 , Plan 1: Foundation (pricing engine + data model)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, unit-tested pricing engine and the v2 database schema , the foundation the admin calculator, client page, and AI layer all depend on.

**Architecture:** A pure TypeScript pricing module (`src/lib/quote-pricing.ts`) with zero UI/DB deps, covered by Vitest unit tests. Plus a Supabase migration that reshapes `price_quotes` / `quote_catalog` / `quote_defaults` per spec §10 + §13, and the token RPCs (public read, sign, mark-viewed).

**Tech Stack:** TypeScript, Vitest (new), Supabase Postgres (migrations via MCP `apply_migration` to branch `dbchappsqcsixxecxzqv`).

**Reference:** spec `docs/superpowers/specs/2026-07-15-quote-system-v2-design.md` (§2 pricing, §10 data, §13 decisions).

## Global Constraints

- Work on the `staging` branch only. Never push to `main` without Ori's explicit approval.
- No "Co-Authored-By" trailer on commits.
- No em-dashes ("—") anywhere in copy or output.
- Money base is **ex-VAT**; VAT is display-only (`vat_pct` default 18).
- `price_quotes.content` is a **per-quote snapshot**; editing a quote never writes back to `quote_catalog`.
- Multipliers are **per-type** (default same across types, editable).
- Premium floor is a **soft warning**, never a hard block.
- `share_token` is a random `uuid` (gen_random_uuid), never a serial id.
- Keep `npm run build` green after every task.
- The current v2-predecessor code (old QuoteTool/QuotePage/quote.ts on staging) stays untouched until v2 is proven; this plan adds `quote-pricing.ts` alongside, does not delete the old files.

---

### Task 1: Vitest setup

**Files:**
- Modify: `package.json` (add devDep + `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm test` command running Vitest in node env.

- [ ] **Step 1: Install Vitest**

Run: `npm i -D vitest@^2`
Expected: added to devDependencies, no peer errors (Vite 5 present).

- [ ] **Step 2: Add the test script**

In `package.json` scripts add: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 4: Write a smoke test**

`src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__tests__/smoke.test.ts
git commit -m "chore(test): add Vitest for pure-logic unit tests"
```

---

### Task 2: Pricing types + anchor

**Files:**
- Create: `src/lib/quote-pricing.ts`
- Create: `src/lib/quote-pricing.test.ts`

**Interfaces:**
- Produces: `QuoteType`, `WebsiteSubtype`, `ScopeItemKind`, `ScopeItem`, `QuoteScope`, `anchorValue(scope): number`.

- [ ] **Step 1: Write the failing test**

`src/lib/quote-pricing.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { anchorValue, type QuoteScope } from "./quote-pricing";

const scope: QuoteScope = {
  type: "website",
  subtype: "portfolio",
  items: [
    { id: "s", kind: "subtype", label: "תדמית", value: 4000 },
    { id: "p1", kind: "page", label: "בית", value: 2500 },
    { id: "f1", kind: "feature", label: "CMS", value: 1500 },
  ],
};

describe("anchorValue", () => {
  it("sums item values", () => { expect(anchorValue(scope)).toBe(8000); });
  it("is 0 for empty scope", () => {
    expect(anchorValue({ type: "website", items: [] })).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL (module not found / anchorValue undefined).

- [ ] **Step 3: Implement**

`src/lib/quote-pricing.ts`:
```ts
export type QuoteType = "website" | "system" | "automation";
export type WebsiteSubtype =
  | "landing" | "portfolio" | "store" | "catalog" | "content" | "event" | "campaign" | "onepage";
export type ScopeItemKind = "subtype" | "page" | "feature" | "module" | "automation";

export type ScopeItem = { id: string; kind: ScopeItemKind; label: string; value: number };
export type QuoteScope = { type: QuoteType; subtype?: WebsiteSubtype; items: ScopeItem[] };

export function anchorValue(scope: QuoteScope): number {
  return (scope.items ?? []).reduce((sum, it) => sum + (Number(it.value) || 0), 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quote-pricing.ts src/lib/quote-pricing.test.ts
git commit -m "feat(quote): pricing types + anchorValue"
```

---

### Task 3: Price options (per-type multipliers + floor + rationale)

**Files:**
- Modify: `src/lib/quote-pricing.ts`
- Modify: `src/lib/quote-pricing.test.ts`

**Interfaces:**
- Consumes: `anchorValue`.
- Produces: `Multipliers`, `PriceOption`, `priceOptions(anchor, mult, floor): PriceOption[]`, `belowFloor(price, floor): boolean`, `DEFAULT_MULTIPLIERS`.

- [ ] **Step 1: Write the failing test**

Append to `quote-pricing.test.ts`:
```ts
import { priceOptions, belowFloor, DEFAULT_MULTIPLIERS } from "./quote-pricing";

describe("priceOptions", () => {
  it("computes fair/recommended/premium from anchor", () => {
    const o = priceOptions(10000, DEFAULT_MULTIPLIERS, 4500);
    expect(o.map((x) => x.price)).toEqual([10000, 12500, 15000]);
    expect(o.map((x) => x.key)).toEqual(["fair", "recommended", "premium"]);
    expect(o[1].rationale.length).toBeGreaterThan(10);
  });
  it("floors every option at the premium floor", () => {
    const o = priceOptions(3000, DEFAULT_MULTIPLIERS, 4500);
    expect(o.map((x) => x.price)).toEqual([4500, 4500, 4500]);
  });
  it("rounds to whole shekels", () => {
    const o = priceOptions(3333, { fair: 1, recommended: 1.25, premium: 1.5 }, 0);
    expect(o[1].price).toBe(4166);
  });
});

describe("belowFloor", () => {
  it("flags a manual price under the floor", () => {
    expect(belowFloor(4000, 4500)).toBe(true);
    expect(belowFloor(5000, 4500)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `quote-pricing.ts`:
```ts
export type Multipliers = { fair: number; recommended: number; premium: number };
export type PriceOptionKey = "fair" | "recommended" | "premium";
export type PriceOption = { key: PriceOptionKey; label: string; price: number; rationale: string };

export const DEFAULT_MULTIPLIERS: Multipliers = { fair: 1, recommended: 1.25, premium: 1.5 };

const OPTION_META: Record<PriceOptionKey, { label: string; rationale: string }> = {
  fair: { label: "הוגן", rationale: "נכנס לפרויקט, עדיין פרימיום. לתקציב מוגבל או סגירה מהירה." },
  recommended: { label: "מומלץ", rationale: "המחיר שאני ממליץ עליו ברוב המקרים. מאזן ערך ומרווח, ומשאיר מקום לאפסייל." },
  premium: { label: "פרימיום", rationale: "כשהלקוח מבין ערך, או כשההיקף, הסיכון והדחיפות גבוהים." },
};

export function priceOptions(anchor: number, mult: Multipliers, floor: number): PriceOption[] {
  return (["fair", "recommended", "premium"] as PriceOptionKey[]).map((key) => ({
    key,
    label: OPTION_META[key].label,
    rationale: OPTION_META[key].rationale,
    price: Math.max(Math.round((anchor || 0) * mult[key]), Math.round(floor || 0)),
  }));
}

export function belowFloor(price: number, floor: number): boolean {
  return (price || 0) < (floor || 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quote-pricing.ts src/lib/quote-pricing.test.ts
git commit -m "feat(quote): 3 price options with per-type multipliers + soft floor"
```

---

### Task 4: Breakdown scaled to the final price (exact sum)

**Files:**
- Modify: `src/lib/quote-pricing.ts`
- Modify: `src/lib/quote-pricing.test.ts`

**Interfaces:**
- Produces: `BreakdownLine`, `breakdownForFinal(items, finalPrice): BreakdownLine[]`. Each line's `price` is proportional to its `value`, and the lines sum **exactly** to `finalPrice` (last line absorbs rounding).

- [ ] **Step 1: Write the failing test**

Append:
```ts
import { breakdownForFinal } from "./quote-pricing";

const items = [
  { id: "a", kind: "page" as const, label: "בית", value: 4500 },
  { id: "b", kind: "page" as const, label: "אודות", value: 3000 },
  { id: "c", kind: "feature" as const, label: "CMS", value: 2500 },
];

describe("breakdownForFinal", () => {
  it("returns raw values when final equals the sum", () => {
    const b = breakdownForFinal(items, 10000);
    expect(b.map((x) => x.price)).toEqual([4500, 3000, 2500]);
  });
  it("scales proportionally and sums EXACTLY to final", () => {
    const b = breakdownForFinal(items, 13333);
    expect(b.reduce((s, x) => s + x.price, 0)).toBe(13333);
  });
  it("handles zero total without dividing by zero", () => {
    const b = breakdownForFinal([{ id: "z", kind: "page", label: "x", value: 0 }], 5000);
    expect(b[0].price).toBe(5000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append:
```ts
export type BreakdownLine = ScopeItem & { price: number };

export function breakdownForFinal(items: ScopeItem[], finalPrice: number): BreakdownLine[] {
  const list = items ?? [];
  if (list.length === 0) return [];
  const total = list.reduce((s, i) => s + (Number(i.value) || 0), 0);
  if (total <= 0) {
    return list.map((it, i) => ({ ...it, price: i === 0 ? Math.round(finalPrice) : 0 }));
  }
  let acc = 0;
  return list.map((it, i) => {
    const price = i === list.length - 1
      ? Math.round(finalPrice) - acc
      : Math.round(((Number(it.value) || 0) / total) * finalPrice);
    acc += price;
    return { ...it, price };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quote-pricing.ts src/lib/quote-pricing.test.ts
git commit -m "feat(quote): breakdownForFinal (exact-sum apportionment)"
```

---

### Task 5: VAT + payment split helpers

**Files:**
- Modify: `src/lib/quote-pricing.ts`
- Modify: `src/lib/quote-pricing.test.ts`

**Interfaces:**
- Produces: `withVat(net, pct)`, `vatOf(net, pct)`, `paymentSplit(total, depositPct)`, `shekel(n)`.

- [ ] **Step 1: Write the failing test**

Append:
```ts
import { withVat, vatOf, paymentSplit, shekel } from "./quote-pricing";

describe("vat + payment", () => {
  it("adds VAT", () => { expect(withVat(10000, 18)).toBe(11800); });
  it("returns VAT amount", () => { expect(vatOf(10000, 18)).toBe(1800); });
  it("splits by deposit pct, rest = total - deposit", () => {
    const s = paymentSplit(11800, 50);
    expect(s.deposit).toBe(5900);
    expect(s.rest).toBe(5900);
    expect(s.deposit + s.rest).toBe(11800);
  });
  it("formats shekels he-IL", () => { expect(shekel(11800)).toBe("₪11,800"); });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append:
```ts
export function withVat(net: number, pct: number): number {
  return Math.round((net || 0) * (1 + (pct || 0) / 100));
}
export function vatOf(net: number, pct: number): number {
  return withVat(net, pct) - Math.round(net || 0);
}
export function paymentSplit(total: number, depositPct: number): { deposit: number; rest: number; depositPct: number } {
  const pct = Math.min(100, Math.max(0, depositPct ?? 50));
  const deposit = Math.round((total * pct) / 100);
  return { deposit, rest: Math.max(0, Math.round(total) - deposit), depositPct: pct };
}
export function shekel(n: number): string {
  return "₪" + Math.round(n || 0).toLocaleString("he-IL");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` then `npm run build`
Expected: PASS, build green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quote-pricing.ts src/lib/quote-pricing.test.ts
git commit -m "feat(quote): vat + payment-split helpers (tested)"
```

---

### Task 6: v2 DB migration (tables + top-level columns)

**Files:**
- Create: `supabase/migrations/20260715120000_quote_v2_schema.sql`
- Test (verification): SQL queries via MCP `execute_sql` on branch `dbchappsqcsixxecxzqv`.

**Interfaces:**
- Produces: reshaped `price_quotes` (top-level: `type`, `subtype`, `final_price`, `anchor_value`, `client_business`, `sent_at`, `viewed_at`, `signed_ip`), extended `quote_catalog` (kind incl `module`/`automation`, `recommended`), `quote_type_multipliers` (per-type fair/recommended/premium + floor).

- [ ] **Step 1: Write the migration**

```sql
alter table public.price_quotes
  add column if not exists type text not null default 'website'
    check (type in ('website','system','automation')),
  add column if not exists subtype text,
  add column if not exists final_price numeric,
  add column if not exists anchor_value numeric,
  add column if not exists client_business text,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists signed_ip text;

alter table public.quote_catalog
  drop constraint if exists quote_catalog_kind_check;
alter table public.quote_catalog
  add constraint quote_catalog_kind_check
  check (kind in ('subtype','page','feature','module','automation','upsell'));

create table if not exists public.quote_type_multipliers (
  type text primary key check (type in ('website','system','automation')),
  fair numeric not null default 1,
  recommended numeric not null default 1.25,
  premium numeric not null default 1.5,
  floor numeric not null default 0
);
insert into public.quote_type_multipliers (type, floor) values
  ('website', 4500), ('system', 12000), ('automation', 2500)
on conflict (type) do nothing;

alter table public.quote_type_multipliers enable row level security;
create policy "qtm_admin" on public.quote_type_multipliers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Apply to branch**

Use MCP `apply_migration` (project `dbchappsqcsixxecxzqv`, name `quote_v2_schema`) with the SQL above.
Expected: `{success:true}`.

- [ ] **Step 3: Verify**

Run via `execute_sql`:
```sql
select column_name from information_schema.columns
where table_name='price_quotes' and column_name in ('type','subtype','final_price','anchor_value','sent_at','viewed_at','signed_ip');
select type, floor from public.quote_type_multipliers order by type;
```
Expected: 7 columns present; 3 multiplier rows with floors 4500/12000/2500.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260715120000_quote_v2_schema.sql
git commit -m "feat(quote): v2 schema (types, top-level columns, per-type multipliers)"
```

---

### Task 7: Token RPCs (public read + sign with IP + mark viewed)

**Files:**
- Create: `supabase/migrations/20260715130000_quote_v2_rpcs.sql`
- Test (verification): SQL via MCP on branch.

**Interfaces:**
- Produces: `get_quote_public(p_token uuid)` returning the new fields (incl `type`, `subtype`, `final_price`, `viewed_at`, `sent_at`), `sign_quote(p_token, p_name, p_signature_image, p_selected jsonb, p_ip text)` storing `signed_ip`, and `mark_quote_viewed(p_token)` setting `viewed_at` once. All granted to anon + authenticated.

- [ ] **Step 1: Write the RPC migration**

```sql
create or replace function public.get_quote_public(p_token uuid)
returns jsonb language sql security definer set search_path to 'public' stable as $function$
  select jsonb_build_object(
    'id', q.id, 'title', q.title, 'client_name', q.client_name, 'client_business', q.client_business,
    'type', q.type, 'subtype', q.subtype, 'status', q.status,
    'final_price', q.final_price, 'content', q.content - 'notes', 'selected', q.selected,
    'signed_name', q.signed_name, 'signed_at', q.signed_at, 'created_at', q.created_at,
    'sent_at', q.sent_at, 'viewed_at', q.viewed_at, 'org_name', o.name
  )
  from public.price_quotes q left join public.organizations o on o.id = q.org_id
  where q.share_token = p_token limit 1;
$function$;
grant execute on function public.get_quote_public(uuid) to anon, authenticated;

create or replace function public.mark_quote_viewed(p_token uuid)
returns void language sql security definer set search_path to 'public' as $function$
  update public.price_quotes set viewed_at = now()
  where share_token = p_token and viewed_at is null and status in ('sent','draft');
$function$;
grant execute on function public.mark_quote_viewed(uuid) to anon, authenticated;

create or replace function public.sign_quote(
  p_token uuid, p_name text, p_signature_image text,
  p_selected jsonb default '{}'::jsonb, p_ip text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_title text;
begin
  update public.price_quotes
     set status='signed', signed_name=nullif(left(coalesce(p_name,''),120),''),
         signature_image=nullif(p_signature_image,''), signed_at=now(),
         signed_ip=nullif(p_ip,''), selected=coalesce(p_selected,'{}'::jsonb), updated_at=now()
   where share_token=p_token and status in ('draft','sent')
   returning id, title into v_id, v_title;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'quote not found or already signed'); end if;
  perform public.notify_admin('quote', 'הצעת מחיר נחתמה · ' || coalesce(v_title,'הצעה'),
    coalesce(p_name,'הלקוח') || ' אישר את ההצעה', '/admin/tools/quote', null, v_id);
  return jsonb_build_object('ok', true);
end; $function$;
grant execute on function public.sign_quote(uuid, text, text, jsonb, text) to anon, authenticated;
```

- [ ] **Step 2: Apply to branch** via MCP `apply_migration` (name `quote_v2_rpcs`).

- [ ] **Step 3: Verify**

Insert a temp quote, call `get_quote_public` and `mark_quote_viewed`, confirm `viewed_at` set and JSON has `type`/`final_price`; then delete the temp row. Expected: JSON contains the new keys; second `mark_quote_viewed` is a no-op.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715130000_quote_v2_rpcs.sql
git commit -m "feat(quote): v2 token RPCs (public read, sign+ip, mark viewed)"
```

---

## Self-review notes

- Spec coverage (this plan): §2 pricing engine (anchor, options, floor, multipliers, breakdown) , Tasks 2-4; VAT/payment , Task 5; §10 data model + §13 columns (type/subtype/final_price/anchor_value/sent_at/viewed_at/signed_ip, per-type multipliers, token) , Tasks 6-7. AI (§9), admin UI (§8), client page (§7) , later plans.
- Types consistent across tasks (`ScopeItem`, `Multipliers`, `PriceOption`, `BreakdownLine`).
- No placeholders; every step has real code or a real command + expected output.

---

## Roadmap (subsequent plans, one per subsystem)

- **Plan 2 , Admin calculator/builder:** type/subtype picker, separated catalogs (pages/features/modules/automations), live anchor, 3 options + rationale + manual override + soft-floor warning, per-line value edit (snapshot only), content editors (narrative/bonuses/upsells/maintenance/phases/faq/legal/testimonial), show-breakdown toggle, draft/sent status. Browser-verified.
- **Plan 3 , Client quote page:** direction ג (dark, tabbed), Ori's first-person voice copy, all sections with pages/features separation, price breakdown toggle, sign with sum-lock + IP capture, expired state, viewed tracking, confetti, WhatsApp, PDF-print. Browser-verified.
- **Plan 4 , AI layer:** edge-fn modes `quote_pricing` (3 prices + rationale), `quote_copy` (narrative/bonuses in Ori's voice), `quote_scope_fill` (from existing discovery/brief), `quote_upsells` (per-client). Button-triggered, mechanical fallback on failure.
- **Plan 5 , Maintenance + polish:** system/automation maintenance tiers (automation ~₪300-500, "מומלץ בחום"), real PDF export, retire the old QuoteTool/QuotePage/quote.ts once v2 is proven, ship to prod.
