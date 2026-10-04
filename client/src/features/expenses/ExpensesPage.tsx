import { useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { deleteExpense } from '@manager-money/core/application/cycle.use-cases';
import { selectActiveCycle, selectConfig } from '@manager-money/core/application/selectors';
import { isLive } from '@manager-money/core/application/state';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatCycleLabel, formatDateLabel } from '@manager-money/core/utils/date';

import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { MoneyTd, Table, Td, Th } from '@/components/ui/table';
import {
  buildExpenseRows,
  categoriesOf,
  EMPTY_FILTER,
  ExpenseFilter,
  ExpenseRow,
  filterExpenseRows,
  sumAmounts,
} from '@/lib/expenses';
import { useDataStore } from '@/store/data.store';

import { ExpenseFormDialog } from './ExpenseFormDialog';

const PAGE_SIZE = 20;

export function ExpensesPage() {
  const doc = useDataStore((state) => state.doc);
  const run = useDataStore((state) => state.run);
  const saving = useDataStore((state) => state.saving);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ExpenseFilter>(EMPTY_FILTER);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const creating = params.get('novo') === '1';

  const activeCycle = doc ? selectActiveCycle(doc) : null;
  const rows = useMemo(() => (doc ? buildExpenseRows(doc) : []), [doc]);
  const filtered = useMemo(() => filterExpenseRows(rows, filter), [rows, filter]);
  const cycles = useMemo(
    () => (doc?.cycles ?? []).filter(isLive).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [doc],
  );
  const formCategories = useMemo(
    () => [
      ...new Set([...getSortedCategories(doc ? selectConfig(doc) : null), ...categoriesOf(rows)]),
    ],
    [doc, rows],
  );

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        id: 'date',
        accessorKey: 'date',
        header: 'Data',
        cell: (info) => formatDateLabel(info.row.original.date),
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: 'Descrição',
        cell: (info) => info.row.original.description || <span className="text-muted">—</span>,
      },
      { id: 'category', accessorKey: 'category', header: 'Categoria' },
      { id: 'cycle', accessorKey: 'cycleLabel', header: 'Ciclo', enableSorting: false },
      { id: 'amount', accessorKey: 'amount', header: 'Valor' },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    autoResetPageIndex: true,
  });

  function update(patch: Partial<ExpenseFilter>) {
    setFilter((current) => ({ ...current, ...patch }));
  }

  function closeCreate() {
    params.delete('novo');
    setParams(params, { replace: true });
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await run((state, ctx) => deleteExpense(state, deleting.id, ctx));
      toast.success('Gasto excluído.');
      setDeleting(null);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Não foi possível excluir.');
    }
  }

  if (!doc) return null;

  const activeFilters = [
    filter.search && { key: 'search', label: `Busca: ${filter.search}`, clear: { search: '' } },
    filter.cycleId && {
      key: 'cycle',
      label: `Ciclo: ${(() => {
        const cycle = cycles.find((item) => item.id === filter.cycleId);
        return cycle ? formatCycleLabel(cycle.startDate, cycle.endDate) : '';
      })()}`,
      clear: { cycleId: null },
    },
    filter.category && {
      key: 'category',
      label: `Categoria: ${filter.category}`,
      clear: { category: null },
    },
    filter.from && {
      key: 'from',
      label: `De ${formatDateLabel(filter.from)}`,
      clear: { from: '' },
    },
    filter.to && { key: 'to', label: `Até ${formatDateLabel(filter.to)}`, clear: { to: '' } },
  ].filter(Boolean) as { key: string; label: string; clear: Partial<ExpenseFilter> }[];

  const pageRows = table.getRowModel().rows;
  const { pageIndex } = table.getState().pagination;

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Gastos à vista de todos os ciclos. Só os do ciclo ativo podem ser editados."
        actions={
          activeCycle ? (
            <Button onClick={() => setParams({ novo: '1' })}>
              <Plus aria-hidden className="h-4 w-4" /> Registrar gasto
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Buscar" className="xl:col-span-2">
          {(props) => (
            <Input
              type="search"
              placeholder="Descrição ou categoria"
              value={filter.search}
              onChange={(event) => update({ search: event.target.value })}
              {...props}
            />
          )}
        </Field>
        <Field label="Ciclo">
          {(props) => (
            <NativeSelect
              value={filter.cycleId ?? ''}
              onChange={(event) => update({ cycleId: event.target.value || null })}
              {...props}
            >
              <option value="">Todos</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {formatCycleLabel(cycle.startDate, cycle.endDate)}
                  {cycle.status === 'active' ? ' (ativo)' : ''}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Categoria">
          {(props) => (
            <NativeSelect
              value={filter.category ?? ''}
              onChange={(event) => update({ category: event.target.value || null })}
              {...props}
            >
              <option value="">Todas</option>
              {categoriesOf(rows).map((category) => (
                <option key={category}>{category}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2 md:col-span-2">
          <Field label="De">
            {(props) => (
              <Input
                type="date"
                value={filter.from}
                onChange={(event) => update({ from: event.target.value })}
                {...props}
              />
            )}
          </Field>
          <Field label="Até">
            {(props) => (
              <Input
                type="date"
                value={filter.to}
                onChange={(event) => update({ to: event.target.value })}
                {...props}
              />
            )}
          </Field>
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => update(chip.clear)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-dark"
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label}
              <X aria-hidden className="h-3 w-3" />
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setFilter(EMPTY_FILTER)}>
            Limpar filtros
          </Button>
        </div>
      ) : null}

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {filtered.length} gasto(s) · total{' '}
        <Money value={sumAmounts(filtered)} className="font-semibold text-ink" />
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum gasto ainda"
          message="Registre o primeiro gasto do ciclo para acompanhar o limite diário."
          action={
            activeCycle ? (
              <Button onClick={() => setParams({ novo: '1' })}>Registrar gasto</Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nada encontrado" message="Nenhum gasto corresponde aos filtros." />
      ) : (
        <>
          <Table>
            <caption className="sr-only">Gastos filtrados, {filtered.length} no total</caption>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const Icon =
                      sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                    return (
                      <Th
                        key={header.id}
                        className={header.id === 'amount' ? 'text-right' : undefined}
                        aria-sort={
                          sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                        }
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 uppercase"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <Icon aria-hidden className="h-3 w-3" />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </Th>
                    );
                  })}
                  <Th className="text-right">Ações</Th>
                </tr>
              ))}
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const expense = row.original;
                return (
                  <tr key={row.id} className="hover:bg-surface-muted">
                    {row
                      .getVisibleCells()
                      .map((cell) =>
                        cell.column.id === 'amount' ? (
                          <MoneyTd key={cell.id}>{formatCurrency(expense.amount)}</MoneyTd>
                        ) : (
                          <Td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Td>
                        ),
                      )}
                    <Td className="text-right whitespace-nowrap">
                      {expense.editable ? (
                        <span className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar gasto ${expense.description || expense.category}`}
                            onClick={() => setEditing(expense)}
                          >
                            <Pencil aria-hidden className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir gasto ${expense.description || expense.category}`}
                            onClick={() => setDeleting(expense)}
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </Button>
                        </span>
                      ) : (
                        <Badge>Ciclo fechado</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <nav
            aria-label="Paginação"
            className="mt-3 flex items-center justify-end gap-3 text-sm text-muted"
          >
            <span>
              Página {pageIndex + 1} de {table.getPageCount()}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Próxima
            </Button>
          </nav>
        </>
      )}

      {activeCycle ? (
        <>
          <ExpenseFormDialog
            open={creating}
            onOpenChange={(open) => (open ? setParams({ novo: '1' }) : closeCreate())}
            cycle={activeCycle}
            categories={formCategories}
          />
          <ExpenseFormDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            cycle={activeCycle}
            categories={formCategories}
            expense={editing ?? undefined}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir gasto?"
        description={
          deleting
            ? `${deleting.description || deleting.category} de ${formatCurrency(deleting.amount)} sairá do ciclo ativo.`
            : ''
        }
        confirmLabel="Excluir"
        busy={saving}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
