-- Manager Money — contrato de dados v1 (F3)
-- Fonte canônica do schema remoto. Ver docs/architecture/contracts.md e ADR-008.

-- ---------------------------------------------------------------------------
-- Função utilitária: carimbo de servidor usado como cursor de pull (ADR-004)
-- ---------------------------------------------------------------------------
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- settings: configuração financeira (1 linha por usuário)
-- ---------------------------------------------------------------------------
create table public.settings (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_income     bigint      not null check (monthly_income >= 0),
  saving_goal        bigint      not null check (saving_goal >= 0),
  payday             smallint    not null default 7 check (payday between 1 and 28),
  custom_categories  text[]      not null default '{}' check (cardinality(custom_categories) <= 50),
  client_updated_at  timestamptz not null,
  server_updated_at  timestamptz not null default clock_timestamp(),
  deleted_at         timestamptz
);

-- ---------------------------------------------------------------------------
-- fixed_expenses: despesas fixas permanentes e parcelamentos
-- ---------------------------------------------------------------------------
create table public.fixed_expenses (
  user_id                uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                     text        not null check (char_length(id) between 1 and 64),
  kind                   text        not null check (kind in ('permanent', 'installment')),
  name                   text        not null check (char_length(name) between 1 and 80),
  category               text        not null check (char_length(category) between 1 and 40),
  amount                 bigint      check (amount >= 0),
  installment_amount     bigint      check (installment_amount >= 0),
  total_installments     integer     check (total_installments >= 1),
  remaining_installments integer     check (remaining_installments >= 0),
  started_at_cycle_id    text,
  client_updated_at      timestamptz not null,
  server_updated_at      timestamptz not null default clock_timestamp(),
  deleted_at             timestamptz,
  primary key (user_id, id),
  constraint fixed_expenses_kind_shape check (
    (kind = 'permanent' and amount is not null and installment_amount is null)
    or
    (kind = 'installment' and amount is null and installment_amount is not null
      and total_installments is not null and remaining_installments is not null
      and remaining_installments <= total_installments)
  )
);

-- ---------------------------------------------------------------------------
-- cycles: ciclos financeiros (FinancialMonth sem os gastos)
-- ---------------------------------------------------------------------------
create table public.cycles (
  user_id                  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                       text        not null check (char_length(id) between 1 and 64),
  start_date               date        not null,
  end_date                 date        not null,
  received_at              timestamptz not null,
  started_at               timestamptz not null,
  closed_at                timestamptz,
  status                   text        not null check (status in ('active', 'closed')),
  initial_available_amount bigint      not null,
  previous_month_debt      bigint      not null check (previous_month_debt >= 0),
  final_balance            bigint,
  client_updated_at        timestamptz not null,
  server_updated_at        timestamptz not null default clock_timestamp(),
  deleted_at               timestamptz,
  primary key (user_id, id),
  constraint cycles_dates check (end_date >= start_date),
  constraint cycles_closed_shape check (
    (status = 'active' and closed_at is null and final_balance is null)
    or
    (status = 'closed' and closed_at is not null and final_balance is not null)
  )
);

-- BR-FIN-013: no máximo um ciclo ativo (não excluído) por usuário
create unique index cycles_one_active_per_user
  on public.cycles (user_id)
  where status = 'active' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- expenses: gastos variáveis
-- ---------------------------------------------------------------------------
create table public.expenses (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  cycle_id          text        not null,
  amount            bigint      not null check (amount > 0),
  category          text        not null check (char_length(category) between 1 and 40),
  description       text        not null check (char_length(description) between 1 and 120),
  date              date        not null,
  created_at        timestamptz not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  primary key (user_id, id),
  foreign key (user_id, cycle_id) references public.cycles (user_id, id) on delete cascade
);

-- Índices de pull incremental (cursor por tabela)
create index settings_pull_idx       on public.settings       (user_id, server_updated_at);
create index fixed_expenses_pull_idx on public.fixed_expenses (user_id, server_updated_at);
create index cycles_pull_idx         on public.cycles         (user_id, server_updated_at);
create index expenses_pull_idx       on public.expenses       (user_id, server_updated_at);

-- Triggers de carimbo de servidor
create trigger settings_server_updated_at       before insert or update on public.settings       for each row execute function public.set_server_updated_at();
create trigger fixed_expenses_server_updated_at before insert or update on public.fixed_expenses for each row execute function public.set_server_updated_at();
create trigger cycles_server_updated_at         before insert or update on public.cycles         for each row execute function public.set_server_updated_at();
create trigger expenses_server_updated_at       before insert or update on public.expenses       for each row execute function public.set_server_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (BR-ACC-005 / ADR-006): cada usuário acessa somente as próprias linhas.
-- Sem política de DELETE: exclusões são lógicas (deleted_at); exclusão física
-- acontece apenas via delete_my_account() em cascata.
-- ---------------------------------------------------------------------------
alter table public.settings       enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.cycles         enable row level security;
alter table public.expenses       enable row level security;

revoke all on public.settings, public.fixed_expenses, public.cycles, public.expenses from anon;
grant select, insert, update on public.settings, public.fixed_expenses, public.cycles, public.expenses to authenticated;

create policy settings_select on public.settings for select to authenticated using ((select auth.uid()) = user_id);
create policy settings_insert on public.settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy settings_update on public.settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy fixed_expenses_select on public.fixed_expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy fixed_expenses_insert on public.fixed_expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fixed_expenses_update on public.fixed_expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy cycles_select on public.cycles for select to authenticated using ((select auth.uid()) = user_id);
create policy cycles_insert on public.cycles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy cycles_update on public.cycles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy expenses_select on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expenses_update on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RPC: exclusão de conta (BR-ACC-003 / RF-16)
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from auth.users where id = uid; -- cascata remove settings, fixed_expenses, cycles, expenses
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
