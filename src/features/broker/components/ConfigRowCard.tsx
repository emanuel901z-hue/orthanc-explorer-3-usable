/**
 * Mobile card representation of one broker configuration row.
 *
 * The fork's convention is that data tables switch to card layouts below the
 * md breakpoint (see CLAUDE.md "Mobile Card Views") — a 4-column DICOM table
 * does not fit a 375px viewport without clipping the action buttons.
 */
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function ConfigRowCard({
  title,
  badges,
  fields,
  actions,
}: {
  title: ReactNode;
  badges?: ReactNode;
  fields: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  return (
    <Card data-testid="config-row">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <span>{title}</span>
              {badges}
            </div>
            {/* label above value: gives long DICOM endpoints the full width
                so they don't break mid-token on narrow screens */}
            <dl className="mt-1 space-y-1">
              {fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="break-all font-mono text-xs">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
