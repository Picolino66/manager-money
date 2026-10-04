import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, Pencil, Trash2 } from 'lucide-react';

import {
  describeStatementComposition,
  formatMonthKey,
  knownItemsTotal,
  PURCHASE_LOCKED_REASON,
  STATEMENT_STATUS_LABEL,
} from '@manager-money/core/application/card-text';
import { formatDayMonth } from '@manager-money/core/application/card-view';
import {
  CardPurchase,
  CardStatement,
  StatementStatus,
} from '@manager-money/core/domain/financial/credit-card';
import { formatCurrency } from '@manager-money/core/utils/currency';

import { Badge, BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STATUS_TONE: Record<StatementStatus, BadgeTone> = {
  open: 'info',
  closed: 'warning',
  overdue: 'critical',
  partial: 'warning',
  paid: 'healthy',
};

type Props = {
  /** Ex.: "Fatura atual". */
  title: string;
  statement: CardStatement;
  /** Ex.: "pesa no ciclo de 10/2026". */
  cycleText: string;
  defaultExpanded?: boolean;
  /** Lançamentos e ações (pagar, juros/multa, desfazer). */
  footer?: ReactNode;
  isPurchaseLocked: (purchase: CardPurchase) => boolean;
  canEditPurchases: boolean;
  onEditPurchase: (purchase: CardPurchase) => void;
  onDeletePurchase: (purchase: CardPurchase) => void;
};

/** BR-FIN-025/026/029/032/033: fatura com principal, encargos, pago, restante, datas e compras. */
export function StatementPanel({
  title,
  statement,
  cycleText,
  defaultExpanded = false,
  footer,
  isPurchaseLocked,
  canEditPurchases,
  onEditPurchase,
  onDeletePurchase,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const monthLabel = formatMonthKey(statement.key);
  const count = statement.installments.length;
  const hasLocked = statement.installments.some((item) => isPurchaseLocked(item.purchase));
  const rows: [string, string, string?][] = [
    ['Fatura', formatCurrency(statement.amount)],
    ...(statement.charges > 0
      ? [
          ['Encargos', formatCurrency(statement.charges), 'text-negative'] as [
            string,
            string,
            string,
          ],
        ]
      : []),
    ['Pago', formatCurrency(statement.paid)],
    ['Fechamento', formatDayMonth(statement.closingDate)],
    ['Vencimento', formatDayMonth(statement.dueDate)],
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="text-sm text-muted">Fatura {monthLabel}</p>
        </div>
        <Badge tone={STATUS_TONE[statement.status]}>
          {STATEMENT_STATUS_LABEL[statement.status]}
        </Badge>
      </div>
      <div>
        <p className="text-sm text-muted">Restante</p>
        <p
          aria-label={`Restante ${formatCurrency(statement.remaining)}`}
          className="text-2xl font-semibold text-ink"
        >
          {formatCurrency(statement.remaining)}
        </p>
      </div>
      <dl className="grid gap-1 text-sm">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className={tone ?? 'text-ink'}>{value}</dd>
          </div>
        ))}
      </dl>
      {statement.knownTotal !== null ? (
        <p className="text-xs text-muted">
          {describeStatementComposition(statement.knownTotal, knownItemsTotal(statement))}
        </p>
      ) : null}
      {cycleText ? <p className="text-xs text-muted">{cycleText}</p> : null}
      {footer}

      {count > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Ocultar' : 'Ver'} compras da fatura ${monthLabel}`}
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 self-start text-sm font-medium text-primary"
        >
          {expanded ? 'Ocultar compras' : `Ver compras (${count})`}
          {expanded ? (
            <ChevronUp aria-hidden className="h-4 w-4" />
          ) : (
            <ChevronDown aria-hidden className="h-4 w-4" />
          )}
        </button>
      ) : (
        <p className="text-sm text-muted">Nenhuma compra nesta fatura.</p>
      )}

      {expanded ? (
        <ul className="flex flex-col divide-y divide-border">
          {statement.installments.map((item) => {
            const locked = isPurchaseLocked(item.purchase);
            const isBalance = item.purchase.kind === 'statement-balance';
            const detail = isBalance
              ? `Total informado · ${formatCurrency(item.amount)}`
              : `Parcela ${item.number}/${item.purchase.installments} · ${formatCurrency(item.nominalAmount)}${item.includedInBalance ? ' · já no total' : ''}`;

            return (
              <li
                key={`${item.purchase.id}-${item.number}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {item.purchase.description}
                  </p>
                  <p className="text-xs text-muted">{detail}</p>
                </div>
                {locked ? (
                  <span
                    aria-label={`${item.purchase.description}: bloqueada`}
                    className="flex items-center gap-1 text-xs text-muted"
                  >
                    <Lock aria-hidden className="h-3.5 w-3.5" /> Bloqueada
                  </span>
                ) : (
                  <span className="inline-flex gap-1">
                    {canEditPurchases ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        aria-label={`Editar compra ${item.purchase.description}`}
                        onClick={() => onEditPurchase(item.purchase)}
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Excluir"
                      aria-label={`Excluir compra ${item.purchase.description}`}
                      onClick={() => onDeletePurchase(item.purchase)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {expanded && hasLocked ? (
        <p className="text-xs text-muted">{PURCHASE_LOCKED_REASON}</p>
      ) : null}
    </Card>
  );
}
