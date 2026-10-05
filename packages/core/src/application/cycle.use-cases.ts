import { addDays, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

import {
  buildFinancialCycleDates,
  calculateDefaultCycleStartDate,
  calculateFinalBalance,
  calculateIncomeTotal,
  calculatePrimaryPayday,
  calculateInitialAvailableAmount,
  calculatePreviousMonthDebt,
  canCloseCycle,
  canReceiveIncomeEarlyForCycle,
  describeCloseCycleBlock,
  getAvailableCategories,
  normalizeCategory,
} from '../domain/financial/financial.calculations';
import {
  CarriedStatement,
  ExpenseInput,
  FinancialConfig,
  FinancialConfigInput,
  FixedExpense,
  isActive,
  MAX_PAYDAY,
  MIN_PAYDAY,
} from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';
import { DomainError } from './errors';
import {
  selectActiveCycle,
  selectClosedMonths,
  selectConfig,
  selectCycleAdjustments,
  selectStatementsToCarry,
  toFinancialMonth,
} from './selectors';
import {
  CycleRecord,
  ExpenseRecord,
  FixedExpenseRecord,
  isLive,
  LocalState,
  SettingsRecord,
  touch,
  UseCaseContext,
} from './state';

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function requireConfig(state: LocalState, message: string): FinancialConfig {
  const config = selectConfig(state);

  if (!config) {
    throw new DomainError(message);
  }

  return config;
}

export function requireActiveCycle(state: LocalState, message: string): CycleRecord {
  const cycle = selectActiveCycle(state);

  if (!cycle) {
    throw new DomainError(message);
  }

  return cycle;
}

function fixedExpenseFields(expense: FixedExpense): string {
  return expense.type === 'installment'
    ? JSON.stringify([
        expense.type,
        expense.name,
        expense.category,
        expense.installmentAmount,
        expense.totalInstallments,
        expense.remainingInstallments,
        expense.startedAtCycleId ?? null,
        isActive(expense),
      ])
    : JSON.stringify([
        expense.type,
        expense.name,
        expense.category,
        expense.amount,
        isActive(expense),
        expense.recurringCardId ?? null,
      ]);
}

/** Substitui um registro de despesa fixa, marcando sujo apenas quando algo mudou. */
function replaceFixedExpense(
  record: FixedExpenseRecord,
  next: FixedExpense,
  now: Date,
): FixedExpenseRecord {
  if (fixedExpenseFields(record) === fixedExpenseFields(next) && isLive(record)) {
    return record;
  }

  return touch({ ...next, updatedAt: record.updatedAt, deletedAt: null, dirty: record.dirty }, now);
}

/** BR-FIN-010: avança as parcelas já iniciadas (uma vez por ciclo aberto); inativas ficam pausadas. */
function advanceInstallments(records: FixedExpenseRecord[], now: Date): FixedExpenseRecord[] {
  return records.map((record) => {
    if (
      !isLive(record) ||
      !isActive(record) ||
      record.type !== 'installment' ||
      !record.startedAtCycleId ||
      record.remainingInstallments <= 0
    ) {
      return record;
    }

    return touch({ ...record, remainingInstallments: record.remainingInstallments - 1 }, now);
  });
}

/** BR-FIN-010: parcelamentos ainda não iniciados passam a contar no ciclo informado. */
function startPendingInstallments(
  records: FixedExpenseRecord[],
  cycleId: string,
  now: Date,
): FixedExpenseRecord[] {
  return records.map((record) => {
    if (
      !isLive(record) ||
      !isActive(record) ||
      record.type !== 'installment' ||
      record.startedAtCycleId
    ) {
      return record;
    }

    return touch({ ...record, startedAtCycleId: cycleId }, now);
  });
}

function configFrom(state: LocalState, fixedExpenses: FixedExpenseRecord[]): FinancialConfig {
  const config = requireConfig(state, 'Configure renda, fixos e meta antes de continuar.');

  return { ...config, fixedExpenses: fixedExpenses.filter(isLive) };
}

function createCycle(
  state: LocalState,
  fixedExpenses: FixedExpenseRecord[],
  startDate: Date,
  previousMonthDebt: number,
  ctx: UseCaseContext,
  carriedStatementDebt = 0,
): CycleRecord {
  const config = configFrom(state, fixedExpenses);
  const dates = buildFinancialCycleDates(startDate, config.payday);
  const id = ctx.newId('cycle');

  return {
    id,
    ...dates,
    startedAt: ctx.now.toISOString(),
    status: 'active',
    initialAvailableAmount: calculateInitialAvailableAmount(
      config,
      previousMonthDebt,
      // Reserva das fixas pendentes com as parcelas já avançadas (BR-FIN-004/010).
      selectCycleAdjustments(
        { ...state, fixedExpenses },
        { id, startDate: dates.startDate, carriedStatementDebt },
      ),
    ),
    previousMonthDebt,
    ...(carriedStatementDebt > 0 ? { carriedStatementDebt } : {}),
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };
}

function sumCarried(items: CarriedStatement[] | undefined): number {
  return (items ?? []).reduce((total, item) => total + item.amount, 0);
}

export function assertDateWithinCycle(cycle: CycleRecord, date: string, subject = 'gasto') {
  const expenseDate = startOfDay(parseISO(date));

  if (
    isBefore(expenseDate, startOfDay(parseISO(cycle.startDate))) ||
    isAfter(expenseDate, startOfDay(parseISO(cycle.endDate)))
  ) {
    throw new DomainError(`A data do ${subject} precisa estar dentro do ciclo ativo.`);
  }
}

function findEditableExpense(state: LocalState, cycle: CycleRecord, expenseId: string) {
  const expense = state.expenses.find(
    (record) => record.id === expenseId && isLive(record) && record.cycleId === cycle.id,
  );

  if (!expense) {
    throw new DomainError('Gasto não encontrado no ciclo ativo.');
  }

  return expense;
}

// ---------------------------------------------------------------------------
// Configuração (RF-01, RF-02, RF-12)
// ---------------------------------------------------------------------------

/** `recurringCardId` vazio vira ausente; só a fixa permanente tem o campo (BR-FIN-035). */
function normalizeRecurringCard(expense: FixedExpense): FixedExpense {
  if (expense.type === 'installment') {
    return expense;
  }

  const { recurringCardId, ...rest } = expense;

  return recurringCardId?.trim() ? { ...rest, recurringCardId: recurringCardId.trim() } : rest;
}

/**
 * BR-FIN-035: o cartão da fixa recorrente precisa existir e estar ativo ao ser marcado. Quem já tinha
 * a marca e não mudou o cartão passa: cartão inativado depois só impede o lançamento, não o salvar.
 */
function assertRecurringCards(state: LocalState, expenses: FixedExpense[]) {
  for (const expense of expenses) {
    if (expense.type !== 'permanent' || !expense.recurringCardId) {
      continue;
    }

    const unchanged = state.fixedExpenses.some(
      (record) =>
        record.id === expense.id &&
        isLive(record) &&
        record.type === 'permanent' &&
        record.recurringCardId === expense.recurringCardId,
    );
    const card = state.creditCards.find(
      (record) => record.id === expense.recurringCardId && isLive(record),
    );

    if (!unchanged && (!card || !card.active)) {
      throw new DomainError(
        `O cartão da despesa recorrente "${expense.name.trim()}" precisa existir e estar ativo.`,
      );
    }
  }
}

export function saveConfig(
  state: LocalState,
  input: FinancialConfigInput,
  ctx: UseCaseContext,
): LocalState {
  const nowIso = ctx.now.toISOString();
  const fixedInput = input.fixedExpenses.map(normalizeRecurringCard);

  assertRecurringCards(state, fixedInput);

  const incomeSources = input.incomeSources.map((source) => ({
    id: source.id,
    name: source.name.trim(),
    amount: source.amount,
    payday: source.payday,
    ...(source.active === false ? { active: false } : {}),
  }));

  if (!incomeSources.some(isActive)) {
    throw new DomainError('Informe ao menos uma fonte de renda ativa.');
  }

  if (
    incomeSources.some(
      (source) =>
        !Number.isInteger(source.payday) ||
        source.payday < MIN_PAYDAY ||
        source.payday > MAX_PAYDAY,
    )
  ) {
    throw new DomainError(
      `O dia de pagamento de cada fonte deve ficar entre ${MIN_PAYDAY} e ${MAX_PAYDAY}.`,
    );
  }

  const nextSettingsFields = {
    monthlyIncome: calculateIncomeTotal(incomeSources),
    incomeSources,
    savingGoal: input.savingGoal,
    payday: calculatePrimaryPayday(incomeSources),
    customCategories: input.customCategories.map(normalizeCategory),
  };
  const currentSettings = state.settings;
  const settings: SettingsRecord =
    currentSettings &&
    isLive(currentSettings) &&
    JSON.stringify([
      currentSettings.monthlyIncome,
      currentSettings.incomeSources,
      currentSettings.savingGoal,
      currentSettings.payday,
      currentSettings.customCategories,
    ]) === JSON.stringify(Object.values(nextSettingsFields))
      ? currentSettings
      : { ...nextSettingsFields, updatedAt: nowIso, deletedAt: null, dirty: true };

  const inputIds = new Set(fixedInput.map((expense) => expense.id));
  let fixedExpenses: FixedExpenseRecord[] = state.fixedExpenses.map((record) => {
    const next = fixedInput.find((expense) => expense.id === record.id);

    if (next) {
      return replaceFixedExpense(record, next, ctx.now);
    }

    return isLive(record) ? touch({ ...record, deletedAt: nowIso }, ctx.now) : record;
  });

  for (const expense of fixedInput) {
    if (!state.fixedExpenses.some((record) => record.id === expense.id)) {
      fixedExpenses.push({ ...expense, updatedAt: nowIso, deletedAt: null, dirty: true });
    }
  }

  fixedExpenses = fixedExpenses.filter((record) => inputIds.has(record.id) || record.deletedAt);

  let nextState: LocalState = { ...state, settings, fixedExpenses };
  const activeCycle = selectActiveCycle(nextState);

  if (!activeCycle) {
    return nextState;
  }

  // BR-FIN-014: recalcula o saldo inicial do ciclo ativo com a nova configuração.
  fixedExpenses = startPendingInstallments(fixedExpenses, activeCycle.id, ctx.now);
  nextState = { ...nextState, fixedExpenses };
  const initialAvailableAmount = calculateInitialAvailableAmount(
    configFrom(nextState, fixedExpenses),
    activeCycle.previousMonthDebt,
    selectCycleAdjustments(nextState, activeCycle),
  );

  if (initialAvailableAmount === activeCycle.initialAvailableAmount) {
    return nextState;
  }

  return {
    ...nextState,
    cycles: nextState.cycles.map((cycle) =>
      cycle.id === activeCycle.id ? touch({ ...cycle, initialAvailableAmount }, ctx.now) : cycle,
    ),
  };
}

/** BR-FIN-019/021/023: recalcula o saldo inicial do ciclo ativo (cartão, pagamentos, rendas avulsas). */
export function recalculateActiveCycleBalance(state: LocalState, ctx: UseCaseContext): LocalState {
  const config = selectConfig(state);
  const activeCycle = selectActiveCycle(state);

  if (!config || !activeCycle) {
    return state;
  }

  const initialAvailableAmount = calculateInitialAvailableAmount(
    config,
    activeCycle.previousMonthDebt,
    selectCycleAdjustments(state, activeCycle),
  );

  if (initialAvailableAmount === activeCycle.initialAvailableAmount) {
    return state;
  }

  return {
    ...state,
    cycles: state.cycles.map((cycle) =>
      cycle.id === activeCycle.id ? touch({ ...cycle, initialAvailableAmount }, ctx.now) : cycle,
    ),
  };
}

export function addCategory(state: LocalState, name: string, ctx: UseCaseContext): LocalState {
  const config = requireConfig(state, 'Configure a base financeira antes de criar categorias.');
  const category = normalizeCategory(name);

  if (getAvailableCategories(config).includes(category) || !state.settings) {
    return state;
  }

  return {
    ...state,
    settings: touch(
      { ...state.settings, customCategories: [...state.settings.customCategories, category] },
      ctx.now,
    ),
  };
}

// ---------------------------------------------------------------------------
// Ciclo (RF-03, RF-10, RF-11)
// ---------------------------------------------------------------------------

/** Data de início do próximo ciclo, sem sobrepor o último ciclo fechado (BR-FIN-017). */
export function calculateNextCycleStartDate(state: LocalState, now: Date): Date {
  const config = requireConfig(state, 'Configure renda, fixos e meta antes de iniciar o ciclo.');
  const defaultStart = calculateDefaultCycleStartDate(now, config.payday);
  const lastClosed = selectClosedMonths(state)[0];

  if (lastClosed && !isAfter(defaultStart, startOfDay(parseISO(lastClosed.endDate)))) {
    return addDays(startOfDay(parseISO(lastClosed.endDate)), 1);
  }

  return defaultStart;
}

export function openCycle(state: LocalState, ctx: UseCaseContext): LocalState {
  requireConfig(state, 'Configure renda, fixos e meta antes de iniciar o ciclo.');

  if (selectActiveCycle(state)) {
    throw new DomainError('Já existe um ciclo ativo.');
  }

  const lastClosed = selectClosedMonths(state)[0];
  const previousMonthDebt = calculatePreviousMonthDebt(lastClosed);
  const startDate = calculateNextCycleStartDate(state, ctx.now);
  const advanced = advanceInstallments(state.fixedExpenses, ctx.now);
  const cycle = createCycle(
    state,
    advanced,
    startDate,
    previousMonthDebt,
    ctx,
    sumCarried(lastClosed?.carriedStatements),
  );

  const opened: LocalState = {
    ...state,
    fixedExpenses: startPendingInstallments(advanced, cycle.id, ctx.now),
    cycles: [...state.cycles, cycle],
  };

  return recalculateActiveCycleBalance(opened, ctx);
}

export function canReceiveIncomeEarlyNow(state: LocalState, now: Date): boolean {
  const config = selectConfig(state);
  const cycle = selectActiveCycle(state);

  return Boolean(config && cycle && canReceiveIncomeEarlyForCycle(cycle, now, config.payday));
}

/** BR-FIN-003 + BR-FIN-016. */
export function receiveIncomeEarly(state: LocalState, ctx: UseCaseContext): LocalState {
  const config = requireConfig(state, 'Configure renda, fixos e meta antes de receber.');
  const activeCycle = requireActiveCycle(state, 'Nenhum ciclo ativo para antecipar.');

  if (!canReceiveIncomeEarlyForCycle(activeCycle, ctx.now, config.payday)) {
    throw new DomainError(
      `O recebimento antecipado só é permitido antes do dia ${config.payday} e uma vez por ciclo.`,
    );
  }

  const receivedAt = startOfDay(ctx.now);
  const newCycleExpenses = new Set(
    state.expenses
      .filter(
        (expense) =>
          isLive(expense) &&
          expense.cycleId === activeCycle.id &&
          !isBefore(startOfDay(parseISO(expense.date)), receivedAt),
      )
      .map((expense) => expense.id),
  );
  const closedExpenses = toFinancialMonth(state, activeCycle).expenses.filter(
    (expense) => !newCycleExpenses.has(expense.id),
  );
  const carriedStatements = selectStatementsToCarry(state, activeCycle, ctx.now);
  const closedCycle: CycleRecord = touch(
    {
      ...activeCycle,
      endDate: toISODate(addDays(receivedAt, -1)),
      status: 'closed',
      closedAt: ctx.now.toISOString(),
      finalBalance:
        calculateFinalBalance({ ...activeCycle, expenses: closedExpenses }) +
        sumCarried(carriedStatements),
      ...(carriedStatements.length > 0 ? { carriedStatements } : {}),
    },
    ctx.now,
  );
  const previousMonthDebt = calculatePreviousMonthDebt({ ...closedCycle, expenses: [] });
  const advanced = advanceInstallments(state.fixedExpenses, ctx.now);
  const nextCycle = createCycle(
    state,
    advanced,
    receivedAt,
    previousMonthDebt,
    ctx,
    sumCarried(carriedStatements),
  );

  return {
    ...state,
    fixedExpenses: startPendingInstallments(advanced, nextCycle.id, ctx.now),
    cycles: [
      ...state.cycles.map((cycle) => (cycle.id === activeCycle.id ? closedCycle : cycle)),
      nextCycle,
    ],
    expenses: state.expenses.map((expense) =>
      newCycleExpenses.has(expense.id)
        ? touch({ ...expense, cycleId: nextCycle.id }, ctx.now)
        : expense,
    ),
  };
}

export function canCloseActiveCycle(state: LocalState, now: Date): boolean {
  const cycle = selectActiveCycle(state);

  return Boolean(cycle && canCloseCycle(cycle, now));
}

/** RF-11 + BR-FIN-017. */
export function closeCycle(state: LocalState, ctx: UseCaseContext): LocalState {
  const activeCycle = requireActiveCycle(state, 'Nenhum ciclo ativo para fechar.');

  if (!canCloseCycle(activeCycle, ctx.now)) {
    throw new DomainError(describeCloseCycleBlock(activeCycle));
  }

  // BR-FIN-034: o restante de faturas parciais volta ao resultado deste ciclo e segue reservado no
  // próximo.
  const carriedStatements = selectStatementsToCarry(state, activeCycle, ctx.now);
  const closedCycle: CycleRecord = touch(
    {
      ...activeCycle,
      status: 'closed',
      closedAt: ctx.now.toISOString(),
      finalBalance:
        calculateFinalBalance(toFinancialMonth(state, activeCycle)) + sumCarried(carriedStatements),
      ...(carriedStatements.length > 0 ? { carriedStatements } : {}),
    },
    ctx.now,
  );

  return {
    ...state,
    cycles: state.cycles.map((cycle) => (cycle.id === activeCycle.id ? closedCycle : cycle)),
  };
}

// ---------------------------------------------------------------------------
// Gastos (RF-05, RF-06)
// ---------------------------------------------------------------------------

function normalizeExpenseInput(input: ExpenseInput) {
  return {
    amount: input.amount,
    category: normalizeCategory(input.category),
    description: input.description.trim(),
    date: input.date,
  };
}

export function addExpense(
  state: LocalState,
  input: ExpenseInput,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para receber gastos.');
  assertDateWithinCycle(cycle, input.date);

  const expense: ExpenseRecord = {
    id: ctx.newId('expense'),
    ...normalizeExpenseInput(input),
    createdAt: ctx.now.toISOString(),
    cycleId: cycle.id,
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  return { ...state, expenses: [...state.expenses, expense] };
}

export function updateExpense(
  state: LocalState,
  expenseId: string,
  input: ExpenseInput,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para atualizar gastos.');
  const existing = findEditableExpense(state, cycle, expenseId);
  assertDateWithinCycle(cycle, input.date);

  return {
    ...state,
    expenses: state.expenses.map((expense) =>
      expense.id === existing.id
        ? touch({ ...expense, ...normalizeExpenseInput(input) }, ctx.now)
        : expense,
    ),
  };
}

/** RF-06 / SPEC-003: exclusão lógica para propagar no sync. */
export function deleteExpense(
  state: LocalState,
  expenseId: string,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para excluir gastos.');
  const existing = findEditableExpense(state, cycle, expenseId);

  return {
    ...state,
    expenses: state.expenses.map((expense) =>
      expense.id === existing.id
        ? touch({ ...expense, deletedAt: ctx.now.toISOString() }, ctx.now)
        : expense,
    ),
  };
}
