---
id: design.system
type: module
module: design
title: Design system
summary: >
  Tokens de cor (temas claro e escuro), espaçamento, raio e tipografia, hooks useTheme/makeStyles e o
  catálogo de componentes reutilizáveis do app.
code:
  - app/src/design/theme.ts
  - app/src/design/useTheme.ts
  - app/src/store/theme.store.ts
  - app/src/infrastructure/storage/theme-preference.ts
  - app/src/components/AppButton.tsx
  - app/src/components/ThemePreferenceSelector.tsx
adrs: [ADR-021]
tests: [app/src/design/theme.test.ts, app/src/components/ThemePreferenceSelector.test.tsx, app/src/store/theme.store.test.ts, app/src/infrastructure/storage/theme-preference.test.ts]
last_verified_commit: 455a4b1+T-031
---

# Design system

Fonte: [`app/src/design/theme.ts`](../../app/src/design/theme.ts). Nenhuma cor ou espaçamento literal
em telas novas: usar sempre os tokens.

## Temas claro e escuro (ADR-021)

- `lightColors` e `darkColors` têm as mesmas chaves (`ThemeColors`); não existe mais `colors` estático.
- Cores sempre pelo tema ativo:
  - estilos: `const useStyles = makeStyles((colors) => ({ ... }))` no módulo e `const styles = useStyles()`
    no componente (estilos criados uma vez por paleta);
  - valores avulsos (ícones, `placeholderTextColor`, mapas de status): `const { colors } = useTheme()`.
- Preferência **Sistema / Claro / Escuro** em Ajustes → Aparência, salva só no aparelho
  (`@manager-money/theme-preference`, fora do documento sincronizado). "Sistema" segue o aparelho.
- `StatusBar`, tema do React Navigation e splash acompanham o tema; `app.json` usa
  `userInterfaceStyle: automatic` (+ `expo-system-ui` no Android).
- Paleta escura: pares texto/fundo (inclusive status `*`/`*Soft` e `onPrimary`/`primary`) com contraste
  ≥ 4,5 (WCAG AA).

## Tokens

| Grupo | Tokens |
|---|---|
| Superfícies | `background` · `surface` · `surfaceMuted` · `border` · `overlay`/`overlaySoft` (fundo de modal) |
| Texto | `ink` (títulos) · `text` · `muted` · `disabled` |
| Marca | `primary` · `primaryDark` · `primarySoft` · `onPrimary` (texto sobre `primary`) · `onNegative` |
| Status do dia | `healthy`, `warning`, `critical`, `negative` + variantes `*Soft` (BR-FIN-009) |
| Espaçamento | xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 |
| Raio | sm 6 · md 8 |
| Tipografia | title 28 · sectionTitle 20 · body 16 · small 13 · metric 40 |

## Componentes

| Componente | Uso |
|---|---|
| `Screen` | Contêiner com scroll, safe area, teclado e rodapé opcional |
| `Card` | Agrupador de seção |
| `AppButton` | Variantes `primary`, `secondary`, `ghost`, `danger`; `isLoading`; `accessibilityLabel`; altura ≥ 48 |
| `MetricRow` | Par rótulo/valor; `tone` e `indent` |
| `StatusBadge` | Status do dia com texto + cor |
| `ThemePreferenceSelector` | Escolha Sistema/Claro/Escuro (`radiogroup` acessível) |
| `EmptyState` | Estado vazio com ação |
| `CurrencyInput` | Entrada em centavos (BR-FIN-001) |
| `TextInputField`, `SelectField`, `CategoryPicker` | Formulários |
| `FixedExpensesCard` | Cartão expansível (nasce encolhido) de despesas fixas com status (Pendente/Pago) e Pagar/Desfazer |
| `PayFixedExpenseModal` | Modal de pagamento: À vista (Pix, dinheiro ou débito) ou Cartão de crédito com cartão, parcelas e juros; opções em *chips*, sem `Modal` aninhado |

## Diretrizes
- O status nunca é comunicado só pela cor.
- Ações destrutivas (`danger`) sempre pedem confirmação.
- Todo componente novo precisa funcionar nos dois temas (ADR-021).
