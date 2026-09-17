/**
 * Circuit-breaker badge for an upstream source.
 *
 * Renders nothing while the breaker is closed (the normal case) — an open
 * breaker is the exception an operator has to see.
 */
import { useTranslation } from 'react-i18next';
import { CircleOff, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BreakerState } from '@/api/broker';

export function BreakerBadge({ state, retryInS, onReset, pending }: {
  state?: BreakerState | null;
  retryInS?: number | null;
  onReset: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  if (!state || state === 'closed') return null;
  const isOpen = state === 'open';
  const Icon = isOpen ? CircleOff : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${
        isOpen ? 'text-destructive' : 'text-amber-600'
      }`}
      title={isOpen ? t('broker.breakerOpenHint') : t('broker.breakerHalfOpenHint')}
    >
      <Icon className="h-3 w-3" />
      {isOpen
        ? t('broker.breakerOpen', { seconds: retryInS ?? '?' })
        : t('broker.breakerHalfOpen')}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 sm:h-7 sm:w-7"
        aria-label={t('broker.breakerReset')}
        onClick={onReset}
        disabled={pending}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}
