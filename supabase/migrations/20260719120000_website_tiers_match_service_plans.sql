-- The website maintenance tiers offered inside a quote drifted from the
-- studio's real service plans: the quote table said Core 350 / Pro 850 /
-- Ultra VIP 1800 under bare names, while the plans the client actually buys
-- (src/lib/service-plans.ts, and the service dashboard built on it) are
-- Studio Core 450 / Studio Pro 800 / Studio Ultra VIP 1500. A client reading
-- a quote and then the service page saw two different prices.
--
-- `src/lib/service-plans.ts` stays the single source of truth; this aligns the
-- quote catalog to it. Quotes already sent are unaffected: they snapshot their
-- tiers into `content` at send time, by design.
update quote_maintenance_tiers set name = 'Studio Core', price = 450
  where type = 'website' and key = 'core';

update quote_maintenance_tiers set name = 'Studio Pro', price = 800
  where type = 'website' and key = 'pro';

update quote_maintenance_tiers set name = 'Studio Ultra VIP', price = 1500
  where type = 'website' and key = 'ultra';
