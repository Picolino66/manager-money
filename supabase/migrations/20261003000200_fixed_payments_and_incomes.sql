-- Pagamento de despesas fixas por ciclo e rendas avulsas (BR-FIN-021..023, ADR-015).
-- Mesmo padrão das demais tabelas: RLS por usuário, exclusão lógica e carimbo de servidor.

-- ---------------------------------------------------------------------------
-- fixed_payments: um pagamento por despesa fixa e ciclo. Guarda foto do nome/categoria.
-- `amount` é o valor da fixa; `interest` só existe no crédito; a compra no cartão (com juros)
-- fica em card_purchases e é referenciada em `card_purchase_id`.
-- ---------------------------------------------------------------------------
create table public.fixed_payments (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  cycle_id          text        not null,
  fixed_expense_id  text        not null check (char_length(fixed_expense_id) between 1 and 64),
  name              text        not null check (char_length(name) between 1 and 80),
  category          text        not null check (char_length(category) between 1 and 40),
  method            text        not null check (method in ('pix', 'cash', 'debit', 'credit')),
  amount            bigint      not null check (amount >= 0),
  interest          bigint      not null default 0 check (interest >= 0),
  paid_at           date        not null,
  card_purchase_id  text,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  primary key (user_id, id),
  foreign key (user_id, cycle_id) references public.cycles (user_id, id) on delete cascade,
  constraint fixed_payments_credit_shape check (
    (method = 'credit' and card_purchase_id is not null)
    or
    (method <> 'credit' and card_purchase_id is null and interest = 0)
  )
);

-- Uma despesa fixa só pode ter um pagamento vigente por ciclo.
create unique index fixed_payments_one_per_cycle
  on public.fixed_payments (user_id, cycle_id, fixed_expense_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- extra_incomes: rendas avulsas do ciclo
-- ---------------------------------------------------------------------------
create table public.extra_incomes (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  cycle_id          text        not null,
  name              text        not null check (char_length(name) between 1 and 80),
  amount            bigint      not null check (amount > 0),
  date              date        not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  primary key (user_id, id),
  foreign key (user_id, cycle_id) references public.cycles (user_id, id) on delete cascade
);

create index fixed_payments_pull_idx on public.fixed_payments (user_id, server_updated_at);
create index extra_incomes_pull_idx  on public.extra_incomes  (user_id, server_updated_at);

create trigger fixed_payments_server_updated_at before insert or update on public.fixed_payments for each row execute function public.set_server_updated_at();
create trigger extra_incomes_server_updated_at  before insert or update on public.extra_incomes  for each row execute function public.set_server_updated_at();

-- RLS: sem política de DELETE (exclusão lógica); a exclusão da conta apaga em cascata.
alter table public.fixed_payments enable row level security;
alter table public.extra_incomes  enable row level security;

revoke all on public.fixed_payments, public.extra_incomes from anon;
grant select, insert, update on public.fixed_payments, public.extra_incomes to authenticated;

create policy fixed_payments_select on public.fixed_payments for select to authenticated using ((select auth.uid()) = user_id);
create policy fixed_payments_insert on public.fixed_payments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fixed_payments_update on public.fixed_payments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy extra_incomes_select on public.extra_incomes for select to authenticated using ((select auth.uid()) = user_id);
create policy extra_incomes_insert on public.extra_incomes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy extra_incomes_update on public.extra_incomes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
