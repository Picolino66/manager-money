-- ADR-017 / SPEC-016 / SPEC-017: limite e ativo no cartão, fatura e parcelas quitadas na compra,
-- ativo na despesa fixa e pagamentos de fatura. Contrato remoto v1 (aditivo): todas as colunas
-- novas são nulas ou têm padrão, então clientes antigos continuam gravando.

-- ---------------------------------------------------------------------------
-- credit_cards: limite total (opcional) e ativo
-- ---------------------------------------------------------------------------
alter table public.credit_cards
  add column credit_limit bigint check (credit_limit is null or credit_limit >= 0),
  add column active       boolean not null default true;

-- ---------------------------------------------------------------------------
-- card_purchases: fatura da 1ª parcela e parcelas pagas antes do cadastro (situação inicial)
-- ---------------------------------------------------------------------------
alter table public.card_purchases
  add column first_statement_key  text check (first_statement_key is null or first_statement_key ~ '^\d{4}-\d{2}$'),
  add column settled_installments smallint not null default 0,
  add column origin               text check (origin is null or origin = 'existing');

alter table public.card_purchases
  add constraint card_purchases_settled_range check (settled_installments >= 0 and settled_installments < installments);

-- ---------------------------------------------------------------------------
-- fixed_expenses: ativa/inativa
-- ---------------------------------------------------------------------------
alter table public.fixed_expenses
  add column active boolean not null default true;

-- ---------------------------------------------------------------------------
-- statement_payments: pagamento de fatura (libera o limite; juros pesam no ciclo do pagamento)
-- ---------------------------------------------------------------------------
create table public.statement_payments (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  card_id           text        not null,
  statement_key     text        not null check (statement_key ~ '^\d{4}-\d{2}$'),
  cycle_id          text        not null,
  statement_amount  bigint      not null check (statement_amount >= 0),
  paid_amount       bigint      not null,
  paid_at           date        not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  primary key (user_id, id),
  foreign key (user_id, card_id)  references public.credit_cards (user_id, id) on delete cascade,
  foreign key (user_id, cycle_id) references public.cycles (user_id, id) on delete cascade,
  constraint statement_payments_paid_amount check (paid_amount >= statement_amount)
);

-- Uma fatura só pode ter um pagamento vigente.
create unique index statement_payments_one_per_statement
  on public.statement_payments (user_id, card_id, statement_key)
  where deleted_at is null;

create index statement_payments_pull_idx on public.statement_payments (user_id, server_updated_at);

create trigger statement_payments_server_updated_at before insert or update on public.statement_payments for each row execute function public.set_server_updated_at();

-- RLS: sem política de DELETE (exclusão lógica); a exclusão da conta apaga em cascata.
alter table public.statement_payments enable row level security;

revoke all on public.statement_payments from anon;
grant select, insert, update on public.statement_payments to authenticated;

create policy statement_payments_select on public.statement_payments for select to authenticated using ((select auth.uid()) = user_id);
create policy statement_payments_insert on public.statement_payments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy statement_payments_update on public.statement_payments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
