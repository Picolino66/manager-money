import { StatementStatus } from '@manager-money/core/domain/financial/credit-card';

import { BadgeTone } from '@/components/ui/badge';

/** Cor do selo de situação da fatura (detalhe do cartão e relatório de crédito). */
export const STATEMENT_STATUS_TONE: Record<StatementStatus, BadgeTone> = {
  open: 'info',
  closed: 'warning',
  overdue: 'critical',
  partial: 'warning',
  paid: 'healthy',
};
