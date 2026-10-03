-- Múltiplas fontes de renda (BR-FIN-018). Aditivo: `monthly_income` continua sendo a soma
-- das fontes, mantida pelo cliente. Linhas antigas ficam com '[]' e o cliente as interpreta
-- como uma única fonte "Renda".
alter table public.settings
  add column income_sources jsonb not null default '[]'::jsonb
  check (jsonb_typeof(income_sources) = 'array' and jsonb_array_length(income_sources) <= 20);
