-- ============================================================
-- 0006 — Seed: studio admin whitelist + default reward
-- ============================================================
-- The admin email is the server-side source of truth for the admin role
-- (mirrored on the client by VITE_ADMIN_EMAIL). When origuy@origuystudio.com
-- first signs in with Google, handle_new_user() reads this row and grants
-- the admin role.
-- ============================================================

insert into public.allowed_emails (email, role, full_name)
values ('origuy@origuystudio.com', 'admin', 'Ori Guy')
on conflict (email) do update set role = 'admin';

-- Default rewards-store entry: 100 credits = a free month of Studio Pro.
insert into public.rewards (name, description, credit_cost, reward_type, is_active)
values (
  'Studio Pro חודש חינם',
  'חודש ליווי Studio Pro ללא תשלום — תחזוקה, עדכונים ותמיכה.',
  100,
  'studio_pro',
  true
)
on conflict do nothing;
