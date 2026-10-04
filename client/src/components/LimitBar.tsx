import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';

/** Barra do limite comprometido do cartão (nunca indica dinheiro disponível para gastar). */
export function LimitBar({
  committed,
  creditLimit,
}: {
  committed: MoneyCents;
  creditLimit: MoneyCents | null;
}) {
  if (!creditLimit || creditLimit <= 0) return null;

  const percent = Math.max(0, Math.min(100, Math.round((committed / creditLimit) * 100)));

  return (
    <div
      role="progressbar"
      aria-label="Limite comprometido"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
    >
      <div
        className={percent >= 90 ? 'h-full bg-critical' : 'h-full bg-primary'}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
