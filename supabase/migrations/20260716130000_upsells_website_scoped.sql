-- ============================================================
-- Quote v2.2 , scope upsells by type. All current upsells (multilingual,
-- mailing, booking, interactive tools, n8n cross-sell) are website add-ons ,
-- things that live on a site. Automation/system extras are handled as optional
-- scope items, not a separate upsell catalog. So tag every existing upsell row
-- as type='website'; the picker filters by the quote's type (null = universal,
-- kept for future flexibility). Branch DB (dbchappsqcsixxecxzqv) only.
-- ============================================================

update public.quote_catalog set type = 'website' where kind = 'upsell';
