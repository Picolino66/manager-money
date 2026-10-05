-- ADR-023 / SPEC-024: despesa fixa recorrente no cartão de crédito (BR-FIN-035).
-- Contrato remoto v1 (aditivo): coluna nulável, então clientes antigos continuam gravando.
-- Sem chave estrangeira: `fixed_expenses` sincroniza antes de `credit_cards` (contracts.md §3); o
-- cartão é validado pelo núcleo (saveConfig).

alter table public.fixed_expenses
  add column recurring_card_id text
    check (recurring_card_id is null or char_length(recurring_card_id) between 1 and 64),
  -- Só a despesa fixa permanente é recorrente; parcelamento fora do cartão não tem o campo.
  add constraint fixed_expenses_recurring_only_permanent
    check (recurring_card_id is null or kind = 'permanent');
