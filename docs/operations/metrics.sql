-- Métricas de produto M1–M4 e M6 (ADR-007). Executar no SQL Editor do Supabase (role postgres).
-- Cobrem apenas usuários com conta; usuários só locais não aparecem (limitação declarada).
-- Nenhuma consulta lê valores ou descrições; só contagens e datas.

-- M1 — Ativação: % de contas criadas nos últimos 30 dias que configuraram a base E abriram um ciclo em até 24 h
select
  round(100.0 * count(*) filter (
    where exists (select 1 from public.settings s where s.user_id = u.id)
      and exists (select 1 from public.cycles c where c.user_id = u.id and c.started_at <= u.created_at + interval '24 hours')
  ) / nullif(count(*), 0), 1) as m1_ativacao_pct
from auth.users u
where u.created_at >= now() - interval '30 days';

-- M2 — Engajamento: mediana de gastos registrados por usuário ativo na última semana
select percentile_cont(0.5) within group (order by gastos) as m2_mediana_gastos_semana
from (
  select user_id, count(*) as gastos
  from public.expenses
  where created_at >= now() - interval '7 days' and deleted_at is null
  group by user_id
) t;

-- M3 — Resultado: % de ciclos fechados nos últimos 90 dias com saldo final >= 0
select round(100.0 * count(*) filter (where final_balance >= 0) / nullif(count(*), 0), 1) as m3_ciclos_positivos_pct
from public.cycles
where status = 'closed' and deleted_at is null and closed_at >= now() - interval '90 days';

-- M4 — Retenção D30 (aproximação): das contas criadas há 30–37 dias, % com alguma escrita sincronizada nos últimos 7 dias
select round(100.0 * count(*) filter (
  where exists (select 1 from public.expenses e where e.user_id = u.id and e.server_updated_at >= now() - interval '7 days')
) / nullif(count(*), 0), 1) as m4_retencao_d30_pct
from auth.users u
where u.created_at between now() - interval '37 days' and now() - interval '30 days';

-- M6 — Saúde do sync (proxy no servidor): conflitos de ciclo ativo exigem logs da API.
-- Supabase → Logs → API: filtrar status >= 400 em /rest/v1/{settings,fixed_expenses,cycles,expenses}
-- Meta: (requisições 2xx / total) >= 99%.
