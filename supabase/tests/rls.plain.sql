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

do $$ begin assert (select income_sources from public.settings)='[]'::jsonb, 'income_sources padrão'; raise notice 'ok - BR-FIN-018 income_sources default []'; end $$;
update public.settings set income_sources='[{"id":"i1","name":"Salário","amount":880000}]'::jsonb;
do $$ begin assert (select jsonb_array_length(income_sources) from public.settings)=1; raise notice 'ok - BR-FIN-018 income_sources gravado'; end $$;
select pg_temp.expect_error($q$update public.settings set income_sources='{"a":1}'::jsonb$q$,'23514','BR-FIN-018 income_sources não-array rejeitado');

select pg_temp.expect_error($q$insert into public.cycles (id,start_date,end_date,received_at,started_at,status,initial_available_amount,previous_month_debt,client_updated_at) values ('c2','2026-10-07','2026-11-06',now(),now(),'active',1,0,now())$q$,'23505','BR-FIN-013 segundo ciclo ativo rejeitado');
select pg_temp.expect_error($q$insert into public.expenses (user_id,id,cycle_id,amount,category,description,date,created_at,client_updated_at) values ('00000000-0000-0000-0000-00000000000b','e9','c1',100,'Outros','x','2026-10-08',now(),now())$q$,'42501','A não grava em nome de B');
select pg_temp.expect_error($q$insert into public.expenses (id,cycle_id,amount,category,description,date,created_at,client_updated_at) values ('e2','c1',0,'Outros','x','2026-10-08',now(),now())$q$,'23514','gasto com valor 0 rejeitado');
select pg_temp.expect_error($q$insert into public.fixed_expenses (id,kind,name,category,installment_amount,total_installments,remaining_installments,client_updated_at) values ('f1','installment','Notebook','Outros',100,3,5,now())$q$,'23514','restantes > total rejeitado');
select pg_temp.expect_error($q$delete from public.expenses where id='e1'$q$,'42501','DELETE físico negado');

-- cartões e compras no cartão (BR-FIN-019/020)
insert into public.credit_cards (id,name,closing_day,due_day,client_updated_at) values ('k1','Nubank',25,5,now());
insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,created_at,client_updated_at)
values ('p1','k1','Notebook','Educação',300000,3,'2026-10-20','2026-10',now(),now());
do $$ begin assert (select count(*) from public.card_purchases)=1; raise notice 'ok - A grava e vê compra no cartão'; end $$;
select pg_temp.expect_error($q$insert into public.credit_cards (id,name,closing_day,due_day,client_updated_at) values ('k2','X',29,5,now())$q$,'23514','fechamento fora de 1–28 rejeitado');
select pg_temp.expect_error($q$insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,created_at,client_updated_at) values ('p2','k1','x','Outros',0,1,'2026-10-20','2026-10',now(),now())$q$,'23514','compra com valor 0 rejeitada');
select pg_temp.expect_error($q$insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,created_at,client_updated_at) values ('p3','k1','x','Outros',100,49,'2026-10-20','2026-10',now(),now())$q$,'23514','mais de 48 parcelas rejeitado');
select pg_temp.expect_error($q$insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,created_at,client_updated_at) values ('p4','k1','x','Outros',100,1,'2026-10-20','outubro',now(),now())$q$,'23514','first_cycle_key inválida rejeitada');
select pg_temp.expect_error($q$insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,created_at,client_updated_at) values ('p5','inexistente','x','Outros',100,1,'2026-10-20','2026-10',now(),now())$q$,'23503','compra exige cartão existente');
select pg_temp.expect_error($q$delete from public.credit_cards where id='k1'$q$,'42501','DELETE físico de cartão negado');

-- pagamento de despesas fixas e rendas avulsas (BR-FIN-021..023)
insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,client_updated_at)
values ('pay1','c1','aluguel','Aluguel','Moradia','pix',150000,0,'2026-10-08',now());
insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,card_purchase_id,client_updated_at)
values ('pay2','c1','internet','Internet','Assinatura','credit',10000,500,'2026-10-08','p1',now());
insert into public.extra_incomes (id,cycle_id,name,amount,date,client_updated_at) values ('inc1','c1','Freela',50000,'2026-10-09',now());
do $$ begin assert (select count(*) from public.fixed_payments)=2 and (select count(*) from public.extra_incomes)=1; raise notice 'ok - A grava pagamentos e renda avulsa'; end $$;
select pg_temp.expect_error($q$insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,client_updated_at) values ('pay3','c1','aluguel','Aluguel','Moradia','cash',150000,0,'2026-10-09',now())$q$,'23505','BR-FIN-021 segundo pagamento vigente da mesma fixa no ciclo rejeitado');
select pg_temp.expect_error($q$insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,client_updated_at) values ('pay4','c1','luz','Luz','Moradia','weird',100,0,'2026-10-09',now())$q$,'23514','forma de pagamento inválida rejeitada');
select pg_temp.expect_error($q$insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,client_updated_at) values ('pay5','c1','luz','Luz','Moradia','credit',100,0,'2026-10-09',now())$q$,'23514','BR-FIN-022 crédito sem compra no cartão rejeitado');
select pg_temp.expect_error($q$insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,client_updated_at) values ('pay6','c1','luz','Luz','Moradia','pix',100,50,'2026-10-09',now())$q$,'23514','juros fora do crédito rejeitados');
select pg_temp.expect_error($q$insert into public.extra_incomes (id,cycle_id,name,amount,date,client_updated_at) values ('inc2','c1','x',0,'2026-10-09',now())$q$,'23514','BR-FIN-023 renda avulsa com valor 0 rejeitada');
select pg_temp.expect_error($q$insert into public.extra_incomes (id,cycle_id,name,amount,date,client_updated_at) values ('inc3','inexistente','x',100,'2026-10-09',now())$q$,'23503','renda avulsa exige ciclo existente');
update public.fixed_payments set deleted_at=now() where id='pay1';
insert into public.fixed_payments (id,cycle_id,fixed_expense_id,name,category,method,amount,interest,paid_at,client_updated_at)
values ('pay7','c1','aluguel','Aluguel','Moradia','debit',150000,0,'2026-10-10',now());
do $$ begin raise notice 'ok - refazer pagamento após exclusão lógica é aceito'; end $$;
select pg_temp.expect_error($q$delete from public.extra_incomes where id='inc1'$q$,'42501','DELETE físico de renda avulsa negado');

-- limite, ativo, situação inicial e pagamento de fatura (BR-FIN-026..028, ADR-017)
update public.credit_cards set credit_limit=600000, active=false where id='k1';
do $$ begin assert (select credit_limit from public.credit_cards where id='k1')=600000 and (select active from public.credit_cards where id='k1')=false; raise notice 'ok - limite e ativo do cartão gravados'; end $$;
select pg_temp.expect_error($q$update public.credit_cards set credit_limit=-1 where id='k1'$q$,'23514','limite negativo rejeitado');
insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,first_statement_key,settled_installments,created_at,client_updated_at)
values ('p6','k1','Celular','Pessoal',180000,12,'2026-03-25','2026-03','2026-03',5,now(),now());
do $$ begin assert (select settled_installments from public.card_purchases where id='p6')=5 and (select settled_installments from public.card_purchases where id='p1')=0; raise notice 'ok - situação inicial com parcelas quitadas gravada'; end $$;
select pg_temp.expect_error($q$insert into public.card_purchases (id,card_id,description,category,total_amount,installments,purchase_date,first_cycle_key,settled_installments,created_at,client_updated_at) values ('p7','k1','x','Outros',100,2,'2026-10-20','2026-10',2,now(),now())$q$,'23514','parcelas quitadas >= total rejeitado');
select pg_temp.expect_error($q$update public.card_purchases set first_statement_key='novembro' where id='p1'$q$,'23514','first_statement_key inválida rejeitada');
update public.card_purchases set origin='existing' where id='p6';
select pg_temp.expect_error($q$update public.card_purchases set origin='importada' where id='p6'$q$,'23514','origem inválida rejeitada');
insert into public.statement_payments (id,card_id,statement_key,cycle_id,statement_amount,paid_amount,paid_at,client_updated_at)
values ('sp1','k1','2026-10','c1',100000,105000,'2026-11-08',now());
do $$ begin assert (select count(*) from public.statement_payments)=1; raise notice 'ok - A grava pagamento de fatura com juros'; end $$;
select pg_temp.expect_error($q$insert into public.statement_payments (id,card_id,statement_key,cycle_id,statement_amount,paid_amount,paid_at,client_updated_at) values ('sp2','k1','2026-10','c1',100000,100000,'2026-11-08',now())$q$,'23505','BR-FIN-026 segundo pagamento vigente da mesma fatura rejeitado');
select pg_temp.expect_error($q$insert into public.statement_payments (id,card_id,statement_key,cycle_id,statement_amount,paid_amount,paid_at,client_updated_at) values ('sp3','k1','2026-11','c1',100000,90000,'2026-12-08',now())$q$,'23514','valor pago menor que a fatura rejeitado');
select pg_temp.expect_error($q$insert into public.statement_payments (id,card_id,statement_key,cycle_id,statement_amount,paid_amount,paid_at,client_updated_at) values ('sp4','inexistente','2026-11','c1',1,1,'2026-12-08',now())$q$,'23503','pagamento de fatura exige cartão existente');
select pg_temp.expect_error($q$delete from public.statement_payments where id='sp1'$q$,'42501','DELETE físico de pagamento de fatura negado');
update public.fixed_expenses set active=false where id='nenhuma';
do $$ begin raise notice 'ok - coluna active em fixed_expenses disponível'; end $$;

-- ordem closed→active na mesma instrução (contrato §3)
insert into public.cycles (id,start_date,end_date,received_at,started_at,closed_at,status,initial_available_amount,previous_month_debt,final_balance,client_updated_at)
values ('c1','2026-10-07','2026-11-06',now(),now(),now(),'closed',100000,0,98500,now()),
       ('c3','2026-11-03','2026-12-06',now(),now(),null,'active',90000,0,null,now())
on conflict (user_id,id) do update set status=excluded.status, closed_at=excluded.closed_at, final_balance=excluded.final_balance;
do $$ begin assert (select count(*) from public.cycles where status='active')=1; raise notice 'ok - upsert closed→active aceito'; end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b"}',false);
do $$ begin assert (select count(*) from public.cycles)=0 and (select count(*) from public.card_purchases)=0 and (select count(*) from public.credit_cards)=0 and (select count(*) from public.fixed_payments)=0 and (select count(*) from public.extra_incomes)=0 and (select count(*) from public.statement_payments)=0, 'B não vê'; raise notice 'ok - B não vê dados de A'; end $$;
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
