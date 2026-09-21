/**
 * Hl7MappingCard — read extra values out of the ORM message.
 *
 * The parser covers the standard fields. Hospitals put local information
 * elsewhere (room in OBR-18, contrast agent in a ZDS segment) — a mapping names
 * the HL7 location and the DICOM attribute it should fill, so nobody has to
 * change code for a house convention.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { brokerApi, type Hl7FieldMap } from '@/api/broker';
import { getConfig } from '@/config/runtime';
import { useCanWrite } from '@/features/broker/hooks/use-can-write';
import { useAuditedMutation } from '@/features/broker/hooks/use-broker-writes';

export function Hl7MappingCard() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);
  const queryClient = useQueryClient();
  const { canWrite } = useCanWrite();
  const [segment, setSegment] = useState('OBR');
  const [field, setField] = useState('18');
  const [component, setComponent] = useState('0');
  const [tag, setTag] = useState('');

  const mapsQuery = useQuery({
    queryKey: ['broker', 'hl7-field-maps'],
    queryFn: () => brokerApi.hl7FieldMaps.list(),
    enabled: configured,
  });
  const save = useAuditedMutation<
    { segment: string; field: number; component: number; target_tag: string },
    Hl7FieldMap
  >({
    action: 'broker.hl7_field_map.create',
    resourceType: 'brokerConfig',
    resourceId: (body) => `${body.segment}-${body.field}`,
    run: (body) => brokerApi.hl7FieldMaps.create(body),
    invalidate: [['broker', 'hl7-field-maps']],
    successMessage: t('broker.saved'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => brokerApi.hl7FieldMaps.remove(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['broker', 'hl7-field-maps'] }),
  });

  const maps = mapsQuery.data ?? [];
  const fieldNumber = Number(field);
  const ready = segment.trim().length === 3 && Number.isFinite(fieldNumber) && fieldNumber >= 1
    && tag.trim().length > 0;

  return (
    <Card data-testid="hl7-mapping-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{t('broker.hl7MapTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('broker.hl7MapHint')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {maps.length > 0 ? (
          <ul className="space-y-1" data-testid="hl7-mapping-list">
            {maps.map((entry: Hl7FieldMap) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-medium">
                  {entry.segment}-{entry.field}
                  {entry.component ? `.${entry.component}` : ''}
                </span>
                <span className="text-muted-foreground">→</span>
                <Badge variant="outline" className="font-mono text-[10px]">{entry.target_tag}</Badge>
                {!entry.enabled && <Badge variant="secondary">{t('broker.mergeOff')}</Badge>}
                {canWrite && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          aria-label={t('broker.hl7MapDelete', { location: `${entry.segment}-${entry.field}` })}
                          onClick={() => remove.mutate(entry.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t('broker.hl7MapEmpty')}</p>
        )}

        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="map-segment" className="text-xs">{t('broker.hl7MapSegment')}</Label>
              <Input id="map-segment" className="h-9 w-[80px] font-mono" value={segment}
                     onChange={(event) => setSegment(event.target.value.toUpperCase())} />
            </div>
            <div>
              <Label htmlFor="map-field" className="text-xs">{t('broker.hl7MapField')}</Label>
              <Input id="map-field" className="h-9 w-[70px] font-mono" value={field}
                     onChange={(event) => setField(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="map-component" className="text-xs">{t('broker.hl7MapComponent')}</Label>
              <Input id="map-component" className="h-9 w-[70px] font-mono" value={component}
                     onChange={(event) => setComponent(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="map-tag" className="text-xs">{t('broker.hl7MapTag')}</Label>
              <Input id="map-tag" className="h-9 w-[220px] font-mono"
                     placeholder="ScheduledStationAETitle" value={tag}
                     onChange={(event) => setTag(event.target.value)} />
            </div>
            <Button size="sm" disabled={!ready || save.isPending}
                    onClick={() => save.mutate({
                      segment: segment.trim(), field: fieldNumber,
                      component: Number(component) || 0, target_tag: tag.trim(),
                    }, { onSuccess: () => setTag('') })}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              : <Plus className="h-4 w-4 mr-1" />}
              {t('broker.hl7MapAdd')}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('broker.hl7MapComponentHint')}</p>
        {save.isError && (
          <p role="alert" className="text-xs text-destructive">
            {save.error instanceof Error ? save.error.message : String(save.error)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
