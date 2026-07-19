-- The studio is one person, so every studio self-reference must be singular.
-- One seeded FAQ answer still spoke in the plural.
update quote_defaults
set faq = (
  select jsonb_agg(
    case when e->>'a' like '%ואנחנו מסייעים בהקמה ובהגדרה.%'
      then jsonb_set(e, '{a}', to_jsonb(replace(e->>'a', 'ואנחנו מסייעים בהקמה ובהגדרה.', 'ואני מסייע בהקמה ובהגדרה.')))
      else e end
    order by ord)
  from jsonb_array_elements(faq) with ordinality t(e, ord)
)
where type = 'system';
