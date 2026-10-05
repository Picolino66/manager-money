import { useState } from 'react';
import { isAfter, parseISO, startOfDay } from 'date-fns';
import { ArrowLeft, History, Pencil, Power, ReceiptText } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import {
  canModifyCardPurchase,
  deleteCardPurchase,
  setCreditCardActive,
  undoStatementPayment,
} from '@manager-money/core/application/card.use-cases';
import {
  CARD_LIMIT_DISCLAIMER,
  describeCycleWeight,
  describeStatementEntry,
  formatMonthKey,
} from '@manager-money/core/application/card-text';
import {
  buildCardStatementsView,
  formatDayMonth,
  statementCycleKeys,
  weightByCycle,
} from '@manager-money/core/application/card-view';
import {
  selectActiveCycle,
  selectCardLimitUsage,
  selectCardStatements,
  selectConfig,
  selectCreditCards,
} from '@manager-money/core/application/selectors';
import { CardPurchaseRecord } from '@manager-money/core/application/state';
import {
  CardPurchase,
  CardStatement,
  cycleKeyFromStartDate,
} from '@manager-money/core/domain/financial/credit-card';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import { isActive } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

import { LimitBar } from '@/components/LimitBar';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { CardPurchaseFormDialog } from '@/features/expenses/CardPurchaseFormDialog';
import { useDataStore } from '@/store/data.store';

import { CardFormDialog } from './CardFormDialog';
import { PayStatementDialog, StatementChargesDialog } from './StatementDialogs';
import { StatementPanel } from './StatementPanel';

/** Detalhe do cartão: limite, faturas (pagar, juros/multa, desfazer) e compras (editar/excluir). */
export function CardDetailPage() {
  const { id } = useParams();
  const doc = useDataStore((state) => state.doc);
  const run = useDataStore((state) => state.run);
  const saving = useDataStore((state) => state.saving);
  const [editingCard, setEditingCard] = useState(false);
  const [paying, setPaying] = useState<CardStatement | null>(null);
  const [charging, setCharging] = useState<CardStatement | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CardPurchaseRecord | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<CardPurchase | null>(null);

  if (!doc) return null;

  const card = selectCreditCards(doc).find((item) => item.id === id);

  if (!card) {
    return (
      <EmptyState
        title="Cartão não encontrado"
        message="Este cartão não existe mais."
        action={
          <Button asChild>
            <Link to="/cartoes">Voltar aos cartões</Link>
          </Button>
        }
      />
    );
  }

  const today = new Date();
  const config = selectConfig(doc);
  const activeCycle = selectActiveCycle(doc);
  const active = isActive(card);
  const usage = selectCardLimitUsage(doc, card.id);
  const statements = selectCardStatements(doc, card.id, today);
  const view = buildCardStatementsView(card, statements, today, activeCycle?.id ?? null);
  const activeCycleKey = activeCycle ? cycleKeyFromStartDate(activeCycle.startDate) : null;
  const weights = weightByCycle(statements, activeCycleKey);
  const categories = getSortedCategories(config);
  const cycleText = (statement: CardStatement) =>
    describeCycleWeight(
      statementCycleKeys(statement, card, config?.payday ?? null, activeCycleKey),
    );
  const isOverdue = (statement: CardStatement) =>
    isAfter(startOfDay(today), startOfDay(parseISO(statement.dueDate)));
  const isLocked = (purchase: CardPurchase) => !canModifyCardPurchase(doc, purchase);

  async function toggleActive() {
    try {
      await run((state, ctx) => setCreditCardActive(state, card!.id, !active, ctx));
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Não foi possível atualizar.');
    }
  }

  async function undo(paymentId: string) {
    try {
      await run((state, ctx) => undoStatementPayment(state, paymentId, ctx));
      toast.success('Lançamento desfeito.');
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Não foi possível desfazer.');
    }
  }

  async function confirmDeletePurchase() {
    if (!deletingPurchase) return;
    try {
      await run((state, ctx) => deleteCardPurchase(state, deletingPurchase.id, ctx));
      toast.success('Compra excluída.');
      setDeletingPurchase(null);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Não foi possível excluir.');
    }
  }

  function renderEntries(statement: CardStatement) {
    if (statement.payments.length === 0) return null;
    const monthLabel = formatMonthKey(statement.key);

    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Lançamentos</p>
        {statement.payments.map((payment) => {
          const text = describeStatementEntry(payment, formatDayMonth(payment.paidAt));

          return (
            <div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text">{text}</span>
              {payment.cycleId === activeCycle?.id ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Desfazer lançamento ${text} da fatura ${monthLabel}`}
                  onClick={() => void undo(payment.id)}
                >
                  Desfazer
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  function renderPaymentArea(statement: CardStatement) {
    const entries = renderEntries(statement);
    const monthLabel = formatMonthKey(statement.key);

    if (statement.status === 'paid') {
      const last = statement.payments[statement.payments.length - 1];

      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-healthy">
            Quitada{last ? ` em ${formatDayMonth(last.paidAt)}` : ''}
          </p>
          {entries}
        </div>
      );
    }

    if (statement.status === 'open') {
      return (
        <p className="text-sm text-muted">
          Fatura aberta: recebe compras até {formatDayMonth(statement.closingDate)}.
        </p>
      );
    }

    if (statement.remaining <= 0) return entries;

    if (!activeCycle) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Para registrar o pagamento da fatura, é preciso ter um ciclo ativo (abra o ciclo no
            app).
          </p>
          {entries}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {isOverdue(statement) ? (
          <p className="text-sm font-medium text-critical">
            Venceu em {formatDayMonth(statement.dueDate)}. Ao registrar o pagamento, informe o valor
            pago, com juros se houver.
          </p>
        ) : null}
        {statement.status === 'partial' ? (
          <p className="text-sm font-medium text-warning">
            Pagamento parcial: faltam {formatCurrency(statement.remaining)}. O restante continua
            devido; se a fatura pesa no ciclo atual, o que faltar ao fechar vira dívida do próximo.
          </p>
        ) : null}
        {entries}
        <div className="flex flex-wrap gap-2">
          <Button aria-label={`Paguei a fatura ${monthLabel}`} onClick={() => setPaying(statement)}>
            Paguei a fatura
          </Button>
          <Button
            variant="secondary"
            aria-label={`Registrar juros/multa da fatura ${monthLabel}`}
            onClick={() => setCharging(statement)}
          >
            Registrar juros/multa
          </Button>
        </div>
      </div>
    );
  }

  const panelProps = {
    isPurchaseLocked: isLocked,
    canEditPurchases: activeCycle !== null,
    onEditPurchase: (purchase: CardPurchase) =>
      setEditingPurchase(doc.cardPurchases.find((record) => record.id === purchase.id) ?? null),
    onDeletePurchase: setDeletingPurchase,
  };

  return (
    <>
      <Link
        to="/cartoes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Cartões
      </Link>
      <PageHeader
        title={card.name}
        description={`Fecha dia ${card.closingDay} · Vence dia ${card.dueDay}${active ? '' : ' · Não aparece em novas compras; as parcelas continuam valendo.'}`}
        actions={
          <>
            {!active ? <Badge>Inativo</Badge> : null}
            <Button variant="secondary" asChild>
              <Link to={`/historico?cartao=${card.id}`}>
                <ReceiptText aria-hidden className="h-4 w-4" /> Compras no Histórico
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => setEditingCard(true)}>
              <Pencil aria-hidden className="h-4 w-4" /> Editar cartão
            </Button>
            <Button variant="secondary" onClick={() => void toggleActive()}>
              <Power aria-hidden className="h-4 w-4" /> {active ? 'Desativar' : 'Ativar'}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-2">
          <CardTitle>Quanto ainda posso usar deste cartão?</CardTitle>
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Limite total</dt>
              <dd>
                {usage && usage.creditLimit !== null
                  ? formatCurrency(usage.creditLimit)
                  : 'Não informado'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Limite comprometido</dt>
              <dd>{formatCurrency(usage?.committed ?? 0)}</dd>
            </div>
            {usage && usage.available !== null ? (
              <div className="flex justify-between">
                <dt className="text-muted">Limite disponível do cartão</dt>
                <dd
                  className={
                    usage.available < 0
                      ? 'font-semibold text-negative'
                      : 'font-semibold text-healthy'
                  }
                >
                  {formatCurrency(usage.available)}
                </dd>
              </div>
            ) : null}
          </dl>
          {usage && usage.available !== null ? (
            <LimitBar committed={usage.committed} creditLimit={usage.creditLimit} />
          ) : (
            <p className="text-sm text-muted">
              Limite não informado. Informe o limite em &quot;Editar cartão&quot; para acompanhar o
              disponível.
            </p>
          )}
          <p className="text-xs text-muted">
            Comprometido = parcelas das faturas, inclusive futuras, menos o que já foi pago de cada
            fatura. Pagamento parcial libera parte do limite; juros e multas não ocupam limite.
          </p>
          <p className="text-sm font-medium text-ink">{CARD_LIMIT_DISCLAIMER}</p>
        </Card>

        {!activeCycle ? (
          <Card className="bg-warning-soft text-sm text-ink">
            Sem ciclo ativo: abra o ciclo no app para registrar pagamentos de fatura e ver em qual
            ciclo cada fatura pesa.
          </Card>
        ) : null}

        <StatementPanel
          {...panelProps}
          title="Fatura atual"
          statement={view.current}
          cycleText={cycleText(view.current)}
          defaultExpanded
          footer={renderPaymentArea(view.current)}
        />
        <StatementPanel
          {...panelProps}
          title="Próxima fatura"
          statement={view.next}
          cycleText={cycleText(view.next)}
          footer={renderPaymentArea(view.next)}
        />

        {view.future.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">
              {view.future.every((statement) => statement.status === 'open')
                ? 'Faturas futuras'
                : 'Outras faturas'}
            </h2>
            {view.future.map((statement) => (
              <StatementPanel
                {...panelProps}
                key={statement.key}
                title={`Vence ${formatDayMonth(statement.dueDate)}`}
                statement={statement}
                cycleText={cycleText(statement)}
                footer={statement.status === 'open' ? undefined : renderPaymentArea(statement)}
              />
            ))}
          </section>
        ) : null}

        <Card className="flex flex-col gap-2">
          <CardTitle>Quanto vai pesar nos próximos ciclos?</CardTitle>
          {weights.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma parcela em aberto neste cartão.</p>
          ) : (
            <dl className="grid gap-1 text-sm">
              {weights.map((item) => (
                <div key={item.cycleKey} className="flex justify-between">
                  <dt className="text-muted">
                    Ciclo de {formatMonthKey(item.cycleKey)}
                    {item.cycleKey === activeCycleKey ? ' (atual)' : ''}
                  </dt>
                  <dd>{formatCurrency(item.amount)}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-xs text-muted">
            Cada fatura pesa no ciclo em que vence e já sai do que você pode gastar nesse ciclo.
          </p>
        </Card>

        <Card className="flex flex-col items-start gap-2">
          <Button variant="secondary" asChild>
            <Link to={`/cartoes/${card.id}/compras-anteriores`}>
              <History aria-hidden className="h-4 w-4" /> Compras anteriores ao app
            </Link>
          </Button>
          <p className="text-sm text-muted">
            Fatura em aberto ou parcelamento que já existia antes de você usar o app.
          </p>
        </Card>

        {view.paidInActiveCycle.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">Quitadas neste ciclo</h2>
            {view.paidInActiveCycle.map((statement) => (
              <StatementPanel
                {...panelProps}
                key={statement.key}
                title={`Fatura ${formatMonthKey(statement.key)}`}
                statement={statement}
                cycleText={cycleText(statement)}
                footer={renderPaymentArea(statement)}
              />
            ))}
          </section>
        ) : null}
      </div>

      <CardFormDialog open={editingCard} onOpenChange={setEditingCard} card={card} />
      {paying ? (
        <PayStatementDialog
          card={card}
          statement={paying}
          overdue={isOverdue(paying)}
          onClose={() => setPaying(null)}
        />
      ) : null}
      {charging ? (
        <StatementChargesDialog
          card={card}
          statement={charging}
          onClose={() => setCharging(null)}
        />
      ) : null}
      {editingPurchase && activeCycle ? (
        <CardPurchaseFormDialog
          open
          onOpenChange={(open) => !open && setEditingPurchase(null)}
          cycle={activeCycle}
          categories={categories}
          purchase={editingPurchase}
        />
      ) : null}
      <ConfirmDialog
        open={deletingPurchase !== null}
        onOpenChange={(open) => !open && setDeletingPurchase(null)}
        title="Excluir compra?"
        description={
          deletingPurchase
            ? `${deletingPurchase.description} (todas as parcelas) será removida das faturas e o limite volta a ficar livre.`
            : ''
        }
        confirmLabel="Excluir"
        busy={saving}
        onConfirm={() => void confirmDeletePurchase()}
      />
    </>
  );
}
