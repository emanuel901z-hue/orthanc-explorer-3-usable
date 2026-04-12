import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
  Upload,
  Send,
  ShieldCheck,
  Trash2,
  Pencil,
  Tag,
  Download,
  Radio,
  Server,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Filter,
  Search,
  Clock,
  X,
  FileDown,
  CalendarIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { generateDemoActivityEvents } from '@/shared/api/mock/demo-activity-generator';
import { useJobStore } from '@/store/job-store';
import { useAuditStore } from '@/store/audit-store';
import { ActivityEvent, ActivityCategory, ActivitySeverity } from '@/shared/types/activity';
import { Job } from '@/shared/types/job';
import { ActivityDetailPanel } from '@/features/activity/components/ActivityDetailPanel';
import { useActivityUIStore } from '@/store/activity-ui-store';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  upload: <Upload className="h-3.5 w-3.5" />,
  send: <Send className="h-3.5 w-3.5" />,
  anonymize: <ShieldCheck className="h-3.5 w-3.5" />,
  delete: <Trash2 className="h-3.5 w-3.5" />,
  modify: <Pencil className="h-3.5 w-3.5" />,
  label: <Tag className="h-3.5 w-3.5" />,
  download: <Download className="h-3.5 w-3.5" />,
  echo: <Radio className="h-3.5 w-3.5" />,
  system: <Server className="h-3.5 w-3.5" />,
};

const SEVERITY_ICON: Record<ActivitySeverity, React.ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  info: <Info className="h-3.5 w-3.5 text-info" />,
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  job: 'Job',
  audit: 'Audit',
  log: 'System',
};

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  job: 'bg-primary/10 text-primary border-primary/20',
  audit: 'bg-accent/10 text-accent border-accent/20',
  log: 'bg-muted text-muted-foreground border-border',
};

function jobToActivity(job: Job): ActivityEvent {
  const statusLabel = job.status === 'running' ? 'in progress' : job.status;
  return {
    id: job.id,
    timestamp: job.updatedAt,
    category: 'job',
    severity: job.status === 'complete' ? 'success'
      : job.status === 'error' || job.status === 'interrupted' ? 'error'
      : job.status === 'running' ? 'info'
      : 'info',
    title: `${job.type.charAt(0).toUpperCase() + job.type.slice(1)} ${statusLabel}: ${job.label}`,
    action: job.type,
    description: job.error || job.description,
    duration: job.status === 'complete' || job.status === 'error' ? job.updatedAt - job.createdAt : undefined,
    metadata: {
      'Job ID': job.id,
      'Status': job.status,
      ...(job.totalItems ? { 'Total Items': String(job.totalItems) } : {}),
      ...(job.completedItems ? { 'Completed Items': String(job.completedItems) } : {}),
    },
  };
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatRelativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return format(new Date(ts), 'MMM d, HH:mm');
}

export default function ActivityPage() {
  const { t } = useTranslation();
  const { jobs } = useJobStore();
  const { events: liveAuditEvents } = useAuditStore();
  const { pendingSelectId, setPendingSelectId } = useActivityUIStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  // Merge real jobs + live audit events + demo historical data
  const allEvents = useMemo(() => {
    const demoEvents = generateDemoActivityEvents(80);
    const jobEvents = jobs.map(jobToActivity);
    return [...liveAuditEvents, ...jobEvents, ...demoEvents].sort((a, b) => b.timestamp - a.timestamp);
  }, [jobs, liveAuditEvents]);

  // Auto-select event from Job Manager bar
  useEffect(() => {
    if (pendingSelectId && allEvents.length > 0) {
      const match = allEvents.find((e) => e.id === pendingSelectId);
      if (match) setSelectedEvent(match);
      setPendingSelectId(null);
    }
  }, [pendingSelectId, allEvents, setPendingSelectId]);

  const filtered = useMemo(() => {
    let result = allEvents;
    if (categoryFilter !== 'all') result = result.filter((e) => e.category === categoryFilter);
    if (severityFilter !== 'all') result = result.filter((e) => e.severity === severityFilter);
    if (dateFrom) result = result.filter((e) => e.timestamp >= startOfDay(dateFrom).getTime());
    if (dateTo) result = result.filter((e) => e.timestamp <= endOfDay(dateTo).getTime());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.resource?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allEvents, categoryFilter, severityFilter, dateFrom, dateTo, search]);

  const counts = useMemo(() => ({
    total: allEvents.length,
    job: allEvents.filter((e) => e.category === 'job').length,
    audit: allEvents.filter((e) => e.category === 'audit').length,
    log: allEvents.filter((e) => e.category === 'log').length,
    errors: allEvents.filter((e) => e.severity === 'error').length,
  }), [allEvents]);

  const exportCsv = () => {
    const headers = ['Timestamp', 'Category', 'Severity', 'Action', 'Title', 'Description', 'Resource', 'Actor', 'Duration (ms)'];
    const rows = filtered.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.category,
      e.severity,
      e.action,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.resource || '').replace(/"/g, '""')}"`,
      e.actor || '',
      e.duration ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('activity.subtitle')}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <FileDown className="h-3.5 w-3.5" /> {t('activity.exportCsv')}
          </Button>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Clock className="h-3 w-3" />
            {t('activity.events', { count: counts.total })}
          </Badge>
          <Badge variant="outline" className={cn('gap-1.5', categoryFilter === 'job' && 'border-primary bg-primary/5')}>
            <Upload className="h-3 w-3" />
            {t('activity.jobs', { count: counts.job })}
          </Badge>
          <Badge variant="outline" className={cn('gap-1.5', categoryFilter === 'audit' && 'border-accent bg-accent/5')}>
            <ShieldCheck className="h-3 w-3" />
            {t('activity.audit', { count: counts.audit })}
          </Badge>
          <Badge variant="outline" className={cn('gap-1.5', categoryFilter === 'log' && 'border-muted-foreground')}>
            <Server className="h-3 w-3" />
            {t('activity.system', { count: counts.log })}
          </Badge>
          {counts.errors > 0 && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {t('activity.errors', { count: counts.errors })}
            </Badge>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('activity.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {search && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 w-7 p-0"
                      onClick={() => setSearch('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activity.allCategories')}</SelectItem>
                    <SelectItem value="job">{t('activity.job')}</SelectItem>
                    <SelectItem value="audit">{t('activity.auditLabel')}</SelectItem>
                    <SelectItem value="log">{t('activity.systemLabel')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activity.allSeverities')}</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 text-sm", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'MMM d, yyyy') : t('activity.from')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 text-sm", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'MMM d, yyyy') : t('activity.to')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                    <X className="h-3 w-3 mr-1" /> {t('activity.clearDates')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-[140px]">Time</TableHead>
                  <TableHead className="w-[80px]">Type</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-[100px] hidden md:table-cell">Duration</TableHead>
                  <TableHead className="w-[80px] hidden lg:table-cell">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No events match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 200).map((event) => (
                    <TableRow
                      key={event.id}
                      className={cn(
                        'group cursor-pointer transition-colors',
                        selectedEvent?.id === event.id && 'bg-muted'
                      )}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                    >
                      <TableCell className="pr-0">
                        <div className="flex items-center gap-1.5">
                          {SEVERITY_ICON[event.severity]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{formatRelativeTime(event.timestamp)}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(event.timestamp), 'HH:mm:ss')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] h-5 gap-1', CATEGORY_COLORS[event.category])}
                        >
                          {ACTION_ICONS[event.action] || <Info className="h-3 w-3" />}
                          {CATEGORY_LABELS[event.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDuration(event.duration)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {event.actor || '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filtered.length > 200 && (
              <div className="text-center py-3 text-xs text-muted-foreground border-t">
                Showing 200 of {filtered.length} events
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail panel */}
      {selectedEvent && (
        <ActivityDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
