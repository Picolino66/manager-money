# ADR-012 — Upgrade do Expo SDK 54 para 57

- **Status:** ACCEPTED · **Fase:** F2 (evolução) · **Data:** 2026-10-03
- **Atualiza:** [ADR-002](ADR-002-stack-tecnologica.md) (versões da stack)

## Contexto

- O Expo Go das lojas só suporta o SDK mais recente (57). Com o projeto no SDK 54, o desenvolvimento
  por QR code exige instalar um Expo Go antigo fora da loja.
- O relatório de segurança da F6 deixou vulnerabilidades altas e moderadas no tooling de build
  (`image-size`, `postcss`, `uuid` via `xcode`) cuja correção depende de um SDK mais novo.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Manter o SDK 54 | Zero risco agora | Expo Go das lojas incompatível; vulnerabilidades de tooling ficam |
| Subir para o SDK 55 ou 56 | Salto menor | Continua incompatível com o Expo Go atual |
| **Subir para o SDK 57** | Compatível com o Expo Go; tooling atualizado; suporte mais longo | Salto de RN 0.81 → 0.86 e React 19.1 → 19.2 |

## Decisão

Subir para **Expo SDK 57** (expo 57.0.26, React 19.2.3, React Native 0.86.3), com todas as
dependências nativas alinhadas via `npx expo install --fix`. A arquitetura (ADR-001) e o código de
domínio, aplicação e sync não mudam.

## Trade-offs

- Risco de regressões em navegação, teclado e safe-area por causa do salto do React Native.
  Mitigação: 112 testes automatizados, bundle Android, novo APK de teste e a campanha manual.

## Consequências

- Versões do ADR-002 passam a ser as do SDK 57.
- **Reversão:** o commit `398d601` (SDK 54) tem um APK funcionando. O trabalho acontece na branch
  `chore/expo-sdk-57` e só vai para a `master` com o `npm run verify` verde.

## Relações

ADR-002, SPEC-011, T-017, docs/quality/security-report.md
