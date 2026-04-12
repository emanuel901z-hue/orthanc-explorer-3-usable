import { format } from 'date-fns';
import {
  Download, Send, Shield, Pencil, Upload, Eye, Trash2,
  AlertCircle, Clock, Info, CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuditStore } from '@/store/audit-store';
import type { ActivityEvent } from '@/shared/types/activity';

const ACTION_ICONS: Record<string, React.ElementType> = {
  download: Download,
  send: Send,
  anonymize: Shield,
  modify: Pencil,
  upload: Upload,
  view: Eye,
  delete: Trash2,
};

const SEVERITY_STYLES: Record<ActivityEvent['severity'], string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

const SEVERITY_BADGE: Record<ActivityEvent['severity'], string> = {
  info: 'bg-info/10 text-info border-info/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

function formatRelative(ts: number) {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(new Date(ts), 'MMM d, yyyy');
}

interface StudyActivityLogProps {
  studyId?: string;
}

export default function StudyActivityLog({ studyId }: StudyActivityLogProps) {
  const events = useAuditStore((s) => s.events);

  // Show events related to this study, or all events if no filter available
  const filtered = studyId
    ? events.filter(
        (e) =>
          e.resource?.includes(studyId) ||
          e.metadata?.['Study ID'] === studyId ||
          e.description?.includes(studyId)
      )
    : events;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Info className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No activity recorded</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Actions taken on this study during your session will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {filtered.map((entry, idx) => {
        const Icon = ACTION_ICONS[entry.action] ?? CheckCircle2;
        const isLast = idx === filtered.length - 1;
        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline gutter */}
            <div className="flex flex-col items-center pt-1">
              <div className={cn('rounded-full p-1.5 border bg-background', SEVERITY_STYLES[entry.severity])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-5', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{entry.title}</span>
                    {entry.severity === 'error' && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', SEVERITY_BADGE.error)}>
                        <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Error
                      </Badge>
                    )}
                    {entry.severity === 'warning' && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', SEVERITY_BADGE.warning)}>
                        <Clock className="h-2.5 w-2.5 mr-0.5" /> Warning
                      </Badge>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground">{formatRelative(entry.timestamp)}</span>
                  <div className="text-[10px] text-muted-foreground/60">
                    {format(new Date(entry.timestamp), 'HH:mm:ss')}
                  </div>
                </div>
              </div>

              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div className="mt-2 rounded-md border bg-muted/30 p-2 space-y-0.5">
                  {Object.entries(entry.metadata).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">{key}:</span>
                      <span className="font-mono text-[11px]">{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {entry.actor && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70">
                  {entry.actor}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
