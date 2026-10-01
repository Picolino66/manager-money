-- Testes de RLS (pgTAP) — executar com `supabase test db`.
-- Garante BR-ACC-005: um usuário não lê nem escreve dados de outro.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into public.cycles (id, start_date, end_date, received_at, started_at, status, initial_available_amount, previous_month_debt, client_updated_at)
values ('c1', '2026-10-07', '2026-11-06', now(), now(), 'active', 100000, 0, now());

select is((select count(*)::int from public.cycles), 1, 'A vê o próprio ciclo');

select throws_ok(
  $$insert into public.cycles (id, start_date, end_date, received_at, started_at, status, initial_available_amount, previous_month_debt, client_updated_at)
    values ('c2', '2026-10-07', '2026-11-06', now(), now(), 'active', 1, 0, now())$$,
  '23505', null, 'BR-FIN-013: segundo ciclo ativo é rejeitado');

select throws_ok(
  $$insert into public.expenses (user_id, id, cycle_id, amount, category, description, date, created_at, client_updated_at)
    values ('00000000-0000-0000-0000-00000000000b', 'e1', 'c1', 100, 'Outros', 'x', '2026-10-08', now(), now())$$,
  '42501', null, 'A não grava em nome de B');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.cycles), 0, 'B não vê ciclos de A');

update public.cycles set initial_available_amount = 0 where id = 'c1';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select initial_available_amount from public.cycles where id = 'c1'), 100000::bigint, 'B não altera ciclo de A');

set local role anon;
select throws_ok($$select * from public.cycles$$, '42501', null, 'anon sem acesso');

select * from finish();
rollback;
