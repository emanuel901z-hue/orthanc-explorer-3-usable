/**
 * AuditLogsPage — Global audit log viewer (OE2 "EnableAuditLogs" equivalent).
 *
 * Shows all client-side audit events from the in-memory audit store.
 * In Phase 5+, this will be backed by the backend ATNA audit trail.
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Shield, Search, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditStore } from '@/store/audit-store';

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const { events, clear } = useAuditStore();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const actions = useMemo(
    () => [...new Set(events.map((e) => e.action))].sort(),
    [events],
  );

  const filtered = useMemo(() => {
    let result = events;
    if (actionFilter !== 'all') result = result.filter((e) => e.action === actionFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.resource?.toLowerCase().includes(q) ||
          e.user?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [events, search, actionFilter]);

  const handleExport = () => {
    const json = JSON.stringify(filtered, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {t('auditLogs.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('auditLogs.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> {t('auditLogs.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={clear} disabled={events.length === 0}>
            <Trash2 className="h-3.5 w-3.5" /> {t('auditLogs.clear')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('auditLogs.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('auditLogs.allActions')}</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('auditLogs.events', { count: filtered.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">{t('auditLogs.timestamp')}</TableHead>
                  <TableHead className="w-[120px]">{t('auditLogs.action')}</TableHead>
                  <TableHead>{t('auditLogs.event')}</TableHead>
                  <TableHead className="w-[100px]">{t('auditLogs.severity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {t('auditLogs.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{event.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{event.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            event.severity === 'error' ? 'destructive' :
                            event.severity === 'warning' ? 'default' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {event.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y max-h-[600px] overflow-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{t('auditLogs.empty')}</div>
            ) : (
              filtered.map((event) => (
                <div key={event.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">{event.action}</Badge>
                    <Badge
                      variant={
                        event.severity === 'error' ? 'destructive' :
                        event.severity === 'warning' ? 'default' :
                        'secondary'
                      }
                      className="text-xs"
                    >
                      {event.severity}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
