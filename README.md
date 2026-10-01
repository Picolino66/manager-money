# Manager Money

MVP mobile local-first para transformar renda mensal em limite diario de gastos por ciclo financeiro.

O ciclo padrao comeca no dia 7 e termina no dia 6 do mes seguinte. Se a renda cair antes do dia 7, marque "Ja recebi" para fechar o ciclo atual e recalcular o limite diario a partir do novo recebimento.

Compras parceladas no cartao podem ser cadastradas como parcelamentos: cada parcela reduz o saldo disponivel do ciclo ate terminar.

Gastos, despesas fixas e parcelamentos podem ser classificados por categoria. A aba Categorias mostra gastos por periodo, filtro por categoria e grafico por total gasto.

## Stack

- Expo + React Native + TypeScript
- Zustand para estado global
- AsyncStorage para persistencia local
- date-fns para datas
- React Hook Form + Zod para formularios
- Valores monetarios em centavos

## Como rodar

```bash
npm install
npx expo start
```

Use o Expo Go no celular para abrir o QR Code.

## Scripts

```bash
npm run typecheck
npm test
```

## Estrutura

- `src/domain/financial`: tipos e calculos puros do dominio financeiro.
- `src/store`: store Zustand e acoes do app.
- `src/storage`: persistencia local com AsyncStorage.
- `src/navigation`: Tabs + Stack.
- `src/screens`: telas do MVP.
- `src/components`: componentes reutilizaveis.
