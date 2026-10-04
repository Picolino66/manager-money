-- ADR-018 / SPEC-019: total informado da fatura na situação inicial, pagamento parcial com encargos
-- separados e restante de fatura transportado entre ciclos. Contrato remoto v1 (aditivo).

-- ---------------------------------------------------------------------------
-- card_purchases: total informado da fatura e parcela já incluída nele (BR-FIN-032)
-- ---------------------------------------------------------------------------
alter table public.card_purchases
  add column kind                text check (kind is null or kind = 'statement-balance'),
  add column included_in_balance boolean not null default false;

-- ---------------------------------------------------------------------------
-- statement_payments: vários lançamentos por fatura; pagamento parcial; encargos (BR-FIN-033)
-- `charges` sem padrão: linha de cliente antigo chega nula e o app deriva pago − fatura.
-- ---------------------------------------------------------------------------
alter table public.statement_payments
  add column charges bigint check (charges is null or charges >= 0);

-- Linhas antigas: o excedente pago sobre a fatura eram os juros.
update public.statement_payments
   set charges = greatest(paid_amount - statement_amount, 0);

alter table public.statement_payments
  drop constraint statement_payments_paid_amount,
  add constraint statement_payments_amounts check (paid_amount >= 0 and paid_amount + coalesce(charges, 0) > 0);

drop index public.statement_payments_one_per_statement;
create index statement_payments_statement_idx
  on public.statement_payments (user_id, card_id, statement_key)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- cycles: restante de faturas parciais transportado (BR-FIN-034)
-- ---------------------------------------------------------------------------
alter table public.cycles
  add column carried_statement_debt bigint not null default 0 check (carried_statement_debt >= 0),
  add column carried_statements     jsonb  not null default '[]'::jsonb
    check (jsonb_typeof(carried_statements) = 'array' and jsonb_array_length(carried_statements) <= 100);
