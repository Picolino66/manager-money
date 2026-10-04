import { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'info' | 'healthy' | 'warning' | 'critical' | 'negative';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text',
  info: 'bg-info-soft text-info',
  healthy: 'bg-healthy-soft text-healthy',
  warning: 'bg-warning-soft text-warning',
  critical: 'bg-critical-soft text-critical',
  negative: 'bg-negative-soft text-negative',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
