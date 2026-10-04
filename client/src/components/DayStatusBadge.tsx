import { DayStatus } from '@manager-money/core/domain/financial/financial.types';

import { Badge, BadgeTone } from './ui/badge';

/** Mesmos rótulos do app; o status é comunicado por texto e cor. */
const STATUS: Record<DayStatus, { label: string; tone: BadgeTone }> = {
  healthy: { label: 'Saudável', tone: 'healthy' },
  warning: { label: 'Atenção', tone: 'warning' },
  critical: { label: 'Crítico', tone: 'critical' },
  negative: { label: 'Negativo', tone: 'negative' },
};

export function DayStatusBadge({ status }: { status: DayStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
