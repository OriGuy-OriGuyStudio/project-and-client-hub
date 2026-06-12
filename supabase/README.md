# Supabase backend — Studio Ori Guy Portal

Ordered, idempotent-ish migrations under `migrations/`. They must be applied in
filename order (timestamps already sort correctly):

| File | Contents |
|------|----------|
| `…0001_profiles_and_rpc.sql` | `profiles`, `allowed_emails` whitelist, `get_my_role()`/`is_admin()`, signup trigger `handle_new_user()` |
| `…0002_core_tables.sql` | brand, projects (+ computed `warranty_end_date`), stages, approvals, files, checklist, tasks, docs, payments, messages, activity log, admin notes |
| `…0003_partner_tables.sql` | enrollments, referrals, credit ledger, rewards, redemptions |
| `…0004_functions_and_rls.sql` | `get_client_credits()`, `owns_project()`, role-guard trigger, **RLS enabled on every table + all policies** |
| `…0005_storage.sql` | private `project-files` bucket (50 MB + MIME allow-list, server-enforced) + object RLS |
| `…0006_seed.sql` | admin whitelist row (`origuy@origuystudio.com`) + default Studio Pro reward |

## Applying (one-time, after creating the cloud project)

```bash
# 1. Create the project at https://supabase.com/dashboard (note the project ref + db password)
# 2. From the repo root:
npx supabase init          # generates supabase/config.toml (keep existing migrations)
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase db push       # applies all migrations in order

# 3. (optional) regenerate the TS types from the live schema:
npx supabase gen types typescript --linked > src/types/database.ts
```

## Dashboard steps that aren't in SQL

1. **Google OAuth**: Authentication → Providers → Google → enable, paste Client ID/Secret,
   add the redirect URL Supabase shows to the Google Cloud OAuth consent screen.
2. **Auth session timeout**: Authentication → Sessions → set inactivity timeout to 24h.
3. **Warranty-reminder Edge Function** (`functions/warranty-reminder`, deployed; cron in
   migration `…0020_warranty_cron.sql`, runs daily 06:00 UTC). To activate sending, set two
   Edge Function secrets (Dashboard → Edge Functions → Manage secrets):
   - `RESEND_API_KEY` — from Resend, after verifying the `origuystudio.com` sending domain.
   - `CRON_SECRET` — must equal the Vault secret `warranty_cron_secret` (the cron sends it as
     the bearer; read it with `select decrypted_secret from vault.decrypted_secrets where
     name='warranty_cron_secret'`). Until both are set the function fails closed / no-ops.
4. Copy Project URL + anon key into `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Security model (why it's safe)

- `profiles.id == auth.users.id`, so every policy compares `client_id = auth.uid()`.
- Profiles are created **only** by `handle_new_user()`, **only** for whitelisted emails —
  unknown Google accounts get no profile and are denied everywhere (UI shows AccessDenied).
- `is_admin()` / `get_my_role()` are `SECURITY DEFINER` and read `profiles` as the table
  owner, which bypasses RLS — so policies can call them without infinite recursion.
- `is_private` rows (files/tasks/docs) and `admin_client_notes` are blocked at the DB level
  for clients, not merely hidden.
- `activity_log` and `credit_transactions` have no UPDATE/DELETE policy → immutable.
- Storage bucket is private; downloads only via 1-hour signed URLs, and minting a signed URL
  requires passing the SELECT policy (project ownership or admin).
