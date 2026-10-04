import { ReactNode } from 'react';
import { CircleAlert, Inbox } from 'lucide-react';

import { Button } from './button';

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <Inbox aria-hidden className="h-8 w-8 text-muted" />
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-critical bg-critical-soft px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden className="h-8 w-8 text-critical" />
      <p className="max-w-md text-sm text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}
