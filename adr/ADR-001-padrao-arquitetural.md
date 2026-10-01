# ADR-001 — Monólito modular no cliente + BaaS, em camadas

- **Status:** ACCEPTED · **Fase:** F2 · **Data:** 2026-10-01

## Contexto

O MVP é um app Expo com toda a lógica no cliente. A store Zustand mistura orquestração de casos de
uso, regras (por exemplo, divisão de gastos no recebimento antecipado) e persistência. A v1.0 exige
sync em nuvem (RF-14), autenticação (RF-13) e publicação nas lojas, com um desenvolvedor solo.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Manter a store como está | Zero esforço | Regras de ciclo não são testáveis sem AsyncStorage; o sync teria de entrar na mesma store |
| Monólito modular no cliente + BaaS (camadas domain → application → infrastructure/presentation) | Regras puras e testáveis; sync isolado como adapter; sem servidor próprio | Refatorar a store |
| Backend com regras no servidor (API própria) | Regras centralizadas | Quebra o offline-first (RNF-02); custo operacional alto para dev solo |

## Decisão

Adotar **monólito modular no cliente** com **Clean Architecture leve** e **BaaS (Supabase)** como
infraestrutura de persistência remota:

```
src/domain/          regras puras (sem React, sem I/O)            ← não depende de nada
src/application/     casos de uso puros: (estado, comando) → estado ← depende de domain
src/infrastructure/  storage local, sync, cliente Supabase, monitoramento ← depende de application/domain
src/store/           Zustand: liga casos de uso + persistência + sync    ← composição
src/screens|components|navigation|design/  apresentação           ← lê a store, chama ações
```

As regras de negócio executam **no cliente** (offline-first). O servidor garante **isolamento e
integridade estrutural** (RLS, constraints), não regras de cálculo.

## Trade-offs

- Regras no cliente podem ser burladas por um cliente modificado, mas o usuário só afeta os próprios
  dados (BR-ACC-005), então o risco é aceitável.
- Há uma camada a mais (application) para manter.

## Consequências

- `financial.store.ts` vira uma camada fina; a lógica migra para `src/application/`.
- Toda regra nova entra primeiro em `domain` ou `application`, com teste unitário.

## Relações

BR-FIN-*, RNF-02, RF-14 · [overview](../docs/architecture/overview.md) · ADR-003, ADR-004
