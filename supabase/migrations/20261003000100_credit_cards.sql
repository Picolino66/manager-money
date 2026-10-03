-- Cartões de crédito e compras parceladas no cartão (BR-FIN-019 / BR-FIN-020, ADR-014).
-- Mesmo padrão das demais tabelas: RLS por usuário, exclusão lógica e carimbo de servidor.

-- ---------------------------------------------------------------------------
-- credit_cards
-- ---------------------------------------------------------------------------
create table public.credit_cards (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  name              text        not null check (char_length(name) between 1 and 40),
  closing_day       smallint    not null check (closing_day between 1 and 28),
  due_day           smallint    not null check (due_day between 1 and 28),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- card_purchases: `total_amount` já inclui juros; `first_cycle_key` = yyyy-MM do ciclo da 1ª parcela
-- ---------------------------------------------------------------------------
create table public.card_purchases (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  card_id           text        not null,
  description       text        not null check (char_length(description) between 1 and 120),
  category          text        not null check (char_length(category) between 1 and 40),
  total_amount      bigint      not null check (total_amount > 0),
  installments      smallint    not null check (installments between 1 and 48),
  purchase_date     date        not null,
  first_cycle_key   text        not null check (first_cycle_key ~ '^\d{4}-\d{2}$'),
  created_at        timestamptz not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  primary key (user_id, id),
  foreign key (user_id, card_id) references public.credit_cards (user_id, id) on delete cascade
);

create index credit_cards_pull_idx   on public.credit_cards   (user_id, server_updated_at);
create index card_purchases_pull_idx on public.card_purchases (user_id, server_updated_at);

create trigger credit_cards_server_updated_at   before insert or update on public.credit_cards   for each row execute function public.set_server_updated_at();
create trigger card_purchases_server_updated_at before insert or update on public.card_purchases for each row execute function public.set_server_updated_at();

-- RLS: sem política de DELETE (exclusão lógica); a exclusão da conta apaga em cascata.
alter table public.credit_cards   enable row level security;
alter table public.card_purchases enable row level security;

revoke all on public.credit_cards, public.card_purchases from anon;
grant select, insert, update on public.credit_cards, public.card_purchases to authenticated;

create policy credit_cards_select on public.credit_cards for select to authenticated using ((select auth.uid()) = user_id);
create policy credit_cards_insert on public.credit_cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy credit_cards_update on public.credit_cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy card_purchases_select on public.card_purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy card_purchases_insert on public.card_purchases for insert to authenticated with check ((select auth.uid()) = user_id);
create policy card_purchases_update on public.card_purchases for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
