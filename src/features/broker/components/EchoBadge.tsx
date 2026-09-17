/**
 * C-ECHO status badge with a manual "run now" button.
 * Shared by the monitoring page and the source/target configuration pages.
 */
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleHelp, CircleX, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EchoStatus } from '@/api/broker';

export function EchoBadge({ echo, onEcho, pending }: {
  echo: EchoStatus;
  onEcho: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const icon = echo.last_check === null
    ? <CircleHelp className="h-3 w-3" />
    : echo.ok
      ? <CircleCheck className="h-3 w-3" />
      : <CircleX className="h-3 w-3" />;
  const cls = echo.last_check === null
    ? 'text-muted-foreground'
    : echo.ok
      ? 'text-green-600'
      : 'text-destructive';
  return (
    <span className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${cls}`}>
      {icon}
      {echo.last_check === null
        ? t('broker.neverChecked')
        : echo.ok
          ? `${echo.rtt_ms ?? '?'} ms`
          : (echo.error ?? t('broker.echoFailed'))}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 sm:h-7 sm:w-7"
        aria-label={t('broker.echoNow')}
        onClick={onEcho}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
      </Button>
    </span>
  );
}
