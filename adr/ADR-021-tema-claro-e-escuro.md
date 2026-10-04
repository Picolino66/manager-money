# ADR-021 — Tema claro e escuro (mobile e web)

- **Status:** ACCEPTED · **Fase:** F4 (evolução) · **Data:** 2026-10-04
- **Sobrepõe:** `.orchestrator/context.json → scope.excluded` ("tema escuro" deixa de ser excluído) e a
  diretriz "tema claro apenas na v1.0" de `docs/design/design-system.md`.
- **Spec:** [SPEC-021](../specs/SPEC-021-tema-claro-e-escuro.md).

## Contexto

O dono do produto pediu tema escuro no app mobile e no futuro client web. O app usava um objeto
`colors` estático importado por 36 arquivos e lido em `StyleSheet.create` no carregamento do módulo,
então os estilos não podiam reagir a uma troca de tema. `app.json` fixava `userInterfaceStyle: light`.

## Opções consideradas

| Tema | Opção | Prós | Contras |
|---|---|---|---|
| Escolha | Só seguir o sistema | Mais simples | Usuário não pode fixar um tema |
| Escolha | **Sistema + Claro/Escuro manual** | Padrão de mercado; respeita o aparelho por padrão | Uma preferência a guardar |
| Onde guardar | Documento sincronizado (`settings`) | Igual em todos os aparelhos | Migração do documento (v9) e da tabela; tema é preferência de aparelho, não dado financeiro |
| Onde guardar | **Chave própria no AsyncStorage** | Sem migração; nada vai para a nuvem | Cada aparelho escolhe o seu (desejável) |
| Estilos | Context + `useMemo` por componente | Explícito | Boilerplate em 36 arquivos |
| Estilos | **`makeStyles(factory)` com cache por paleta + `useTheme()` sobre o store Zustand** | Troca mecânica; estilos criados no máximo 2 vezes; sem Provider novo (Zustand já é o padrão) | Hooks obrigatórios em componentes que usam cor |

## Decisão

- Paletas `lightColors`/`darkColors` com as mesmas chaves (`ThemeColors`); `colors` estático removido
  para o compilador acusar qualquer uso esquecido. Novos tokens: `onPrimary`, `onNegative`, `overlay`,
  `overlaySoft` (substituem literais).
- Preferência `system | light | dark` no store `theme.store`, persistida em
  `@manager-money/theme-preference`, fora do documento e do sync.
- `StatusBar`, tema do React Navigation e splash (variante `dark`) seguem o tema;
  `userInterfaceStyle: automatic` com `expo-system-ui`.
- Paleta escura com contraste ≥ 4,5 (WCAG AA) nos pares texto/fundo. A paleta clara não mudou.
- **Web:** nasce com os dois temas, mesma regra (sistema + manual, preferência no navegador).

## Consequências

- Componentes novos usam `makeStyles`/`useTheme`; cor literal em tela é proibida.
- Nenhuma mudança de regra de negócio, documento local, contrato ou schema.
