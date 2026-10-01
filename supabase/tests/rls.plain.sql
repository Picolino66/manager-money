-- Testes de RLS e constraints em Postgres puro (espelha rls.test.sql sem pgTAP).
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','a@t'),('00000000-0000-0000-0000-00000000000b','b@t');

create or replace function pg_temp.expect_error(sql text, code text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FALHOU: % (nenhum erro)', label;
exception when others then
  if sqlstate <> code then raise exception 'FALHOU: % (sqlstate % esperado %: %)', label, sqlstate, code, sqlerrm; end if;
  raise notice 'ok - %', label;
end $$;

grant execute on function pg_temp.expect_error(text,text,text) to authenticated, anon;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a"}',false);

insert into public.settings (monthly_income, saving_goal, payday, client_updated_at) values (880000, 150000, 7, now());
insert into public.cycles (id,start_date,end_date,received_at,started_at,status,initial_available_amount,previous_month_debt,client_updated_at)
values ('c1','2026-10-07','2026-11-06',now(),now(),'active',100000,0,now());
insert into public.expenses (id,cycle_id,amount,category,description,date,created_at,client_updated_at)
values ('e1','c1',1500,'Alimentação','Almoço','2026-10-08',now(),now());
do $$ begin assert (select count(*) from public.cycles)=1, 'A vê próprio ciclo'; raise notice 'ok - A vê o próprio ciclo'; end $$;
do $$ begin assert (select user_id from public.settings)='00000000-0000-0000-0000-00000000000a', 'default user_id'; raise notice 'ok - user_id default = auth.uid()'; end $$;

select pg_temp.expect_error($q$insert into public.cycles (id,start_date,end_date,received_at,started_at,status,initial_available_amount,previous_month_debt,client_updated_at) values ('c2','2026-10-07','2026-11-06',now(),now(),'active',1,0,now())$q$,'23505','BR-FIN-013 segundo ciclo ativo rejeitado');
select pg_temp.expect_error($q$insert into public.expenses (user_id,id,cycle_id,amount,category,description,date,created_at,client_updated_at) values ('00000000-0000-0000-0000-00000000000b','e9','c1',100,'Outros','x','2026-10-08',now(),now())$q$,'42501','A não grava em nome de B');
select pg_temp.expect_error($q$insert into public.expenses (id,cycle_id,amount,category,description,date,created_at,client_updated_at) values ('e2','c1',0,'Outros','x','2026-10-08',now(),now())$q$,'23514','gasto com valor 0 rejeitado');
select pg_temp.expect_error($q$insert into public.fixed_expenses (id,kind,name,category,installment_amount,total_installments,remaining_installments,client_updated_at) values ('f1','installment','Notebook','Outros',100,3,5,now())$q$,'23514','restantes > total rejeitado');
select pg_temp.expect_error($q$delete from public.expenses where id='e1'$q$,'42501','DELETE físico negado');

-- ordem closed→active na mesma instrução (contrato §3)
insert into public.cycles (id,start_date,end_date,received_at,started_at,closed_at,status,initial_available_amount,previous_month_debt,final_balance,client_updated_at)
values ('c1','2026-10-07','2026-11-06',now(),now(),now(),'closed',100000,0,98500,now()),
       ('c3','2026-11-03','2026-12-06',now(),now(),null,'active',90000,0,null,now())
on conflict (user_id,id) do update set status=excluded.status, closed_at=excluded.closed_at, final_balance=excluded.final_balance;
do $$ begin assert (select count(*) from public.cycles where status='active')=1; raise notice 'ok - upsert closed→active aceito'; end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b"}',false);
do $$ begin assert (select count(*) from public.cycles)=0, 'B não vê'; raise notice 'ok - B não vê dados de A'; end $$;
update public.cycles set initial_available_amount=0 where id='c3';
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a"}',false);
do $$ begin assert (select initial_available_amount from public.cycles where id='c3')=90000; raise notice 'ok - B não altera dados de A'; end $$;

select public.delete_my_account();
reset role;
do $$ begin assert (select count(*) from public.expenses)=0 and (select count(*) from auth.users)=1; raise notice 'ok - delete_my_account remove usuário e dados em cascata'; end $$;

set role anon;
select pg_temp.expect_error($q$select * from public.cycles$q$,'42501','anon sem acesso às tabelas');
select pg_temp.expect_error($q$select public.delete_my_account()$q$,'42501','anon não executa delete_my_account');
reset role;
\echo 'RLS: todos os testes passaram'
