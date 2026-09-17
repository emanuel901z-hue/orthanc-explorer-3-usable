/**
 * Configuration health panel — the broker's consistency checks.
 *
 * Findings come from `GET /api/v1/health/config` with a stable `code`; the UI
 * renders a localized, actionable sentence and deep-links into the form that
 * has to be fixed. The English `message` is only the fallback.
 */
import { useTranslation } from 'react-i18next';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BrokerFinding, BrokerHealth, FindingSeverity } from '@/api/broker';

/** Which page fixes a finding — entity kind first, then a code fallback. */
const BY_KIND: Record<string, string> = {
  source: '/broker/sources',
  target: '/broker/targets',
  rule: '/broker/rules',
  transform: '/broker/transforms',
};

const BY_CODE: Record<string, string> = {
  no_default_target: '/broker/targets',
  multiple_default_targets: '/broker/targets',
  no_enabled_source: '/broker/sources',
  no_working_source: '/broker/sources',
  aet_whitelist_empty: '/broker/settings',
};

const SEVERITY_ICON: Record<FindingSeverity, typeof CircleAlert> = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

const SEVERITY_CLASS: Record<FindingSeverity, string> = {
  error: 'text-destructive',
  warning: 'text-amber-600',
  info: 'text-muted-foreground',
};

export function HealthPanel({ health, onNavigate }: {
  health?: BrokerHealth;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const findings = health?.findings ?? [];
  const summary = health?.summary ?? { error: 0, warning: 0, info: 0 };

  return (
    <Card data-testid="broker-health">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t('broker.healthTitle')}
          {summary.error > 0 && (
            <Badge variant="destructive" className="text-xs">
              {t('broker.healthErrors', { count: summary.error })}
            </Badge>
          )}
          {summary.error === 0 && summary.warning > 0 && (
            <Badge variant="secondary" className="text-xs">
              {t('broker.healthWarnings', { count: summary.warning })}
            </Badge>
          )}
          {summary.error === 0 && summary.warning === 0 && (
            <Badge variant="outline" className="text-xs">
              {t('broker.healthOk')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {findings.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{t('broker.healthNone')}</p>
        ) : (
          <ul className="divide-y">
            {findings.map((finding) => (
              <FindingRow key={`${finding.code}-${finding.entity?.id ?? ''}`} finding={finding} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding, onNavigate }: {
  finding: BrokerFinding;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = SEVERITY_ICON[finding.severity] ?? Info;
  const target = BY_KIND[finding.entity?.kind ?? ''] ?? BY_CODE[finding.code];
  // i18next interpolates strings — join list details and expose the entity
  // fields, so messages can reference the affected node by name/id.
  const values: Record<string, string | number> = {
    id: finding.entity?.id ?? '',
    name: finding.entity?.name ?? '',
    ...Object.fromEntries(
      Object.entries(finding.details).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : String(value ?? ''),
      ]),
    ),
  };

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_CLASS[finding.severity]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {/* localized, actionable sentence; the API message is the fallback */}
          {t(`broker.health_${finding.code}`, {
            defaultValue: finding.message,
            ...values,
          })}
        </p>
        {finding.entity?.name && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{finding.entity.name}</p>
        )}
      </div>
      {target && (
        <Button variant="outline" size="sm" className="h-8" onClick={() => onNavigate(target)}>
          {t('broker.healthFix')}
        </Button>
      )}
    </li>
  );
}
