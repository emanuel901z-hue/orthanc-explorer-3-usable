import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Send, ShieldCheck, Trash2, Pencil, Tag, Download, Radio, Server,
  CheckCircle2, AlertCircle, AlertTriangle, Info, X, Clock, User, FileText,
  ExternalLink, FolderOpen, RotateCcw, Eye, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ActivityEvent, ActivityCategory, ActivitySeverity } from '@/shared/types/activity';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  upload: <Upload className="h-4 w-4" />,
  send: <Send className="h-4 w-4" />,
  anonymize: <ShieldCheck className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  modify: <Pencil className="h-4 w-4" />,
  label: <Tag className="h-4 w-4" />,
  download: <Download className="h-4 w-4" />,
  echo: <Radio className="h-4 w-4" />,
  system: <Server className="h-4 w-4" />,
};

const SEVERITY_CONFIG: Record<ActivitySeverity, { icon: React.ReactNode; label: string; className: string }> = {
  success: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Success', className: 'text-success bg-success/10 border-success/20' },
  error: { icon: <AlertCircle className="h-4 w-4" />, label: 'Error', className: 'text-destructive bg-destructive/10 border-destructive/20' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, label: 'Warning', className: 'text-warning bg-warning/10 border-warning/20' },
  info: { icon: <Info className="h-4 w-4" />, label: 'Info', className: 'text-info bg-info/10 border-info/20' },
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  job: 'Job',
  audit: 'Audit',
  log: 'System',
};

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

interface DetailRow {
  label: string;
  value: string;
  icon: React.ReactNode;
}

interface ContextualAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function getContextualActions(event: ActivityEvent, navigate: (path: string) => void): ContextualAction[] {
  const actions: ContextualAction[] = [];
  const studyId = event.metadata?.['Study ID'];
  const isSuccess = event.severity === 'success';
  const isError = event.severity === 'error';

  // Navigate to study for study-related actions
  if (studyId && (event.action === 'upload' || event.action === 'send' || event.action === 'anonymize' || event.action === 'modify' || event.action === 'download')) {
    actions.push({
      label: 'Go to Study',
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      onClick: () => navigate(`/studies/${studyId}`),
    });
  }

  // Browse studies for uploads without a specific study ID
  if (event.action === 'upload' && isSuccess && !studyId) {
    actions.push({
      label: 'Browse Studies',
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      onClick: () => navigate('/studies'),
    });
  }

  // Upload page for failed uploads (retry)
  if (event.action === 'upload' && isError) {
    actions.push({
      label: 'Go to Upload',
      icon: <Upload className="h-3.5 w-3.5" />,
      onClick: () => navigate('/upload'),
    });
  }

  // Remote sources for send & echo actions
  if (event.action === 'send' || event.action === 'echo') {
    actions.push({
      label: 'View Remote Sources',
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      onClick: () => navigate('/remote-sources'),
    });
  }

  // Settings for system events
  if (event.action === 'system') {
    actions.push({
      label: 'Open Settings',
      icon: <Settings className="h-3.5 w-3.5" />,
      onClick: () => navigate('/settings'),
    });
  }

  // Deleted studies → go to study list
  if (event.action === 'delete') {
    actions.push({
      label: 'Browse Studies',
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      onClick: () => navigate('/studies'),
    });
  }

  return actions;
}

interface ActivityDetailPanelProps {
  event: ActivityEvent | null;
  onClose: () => void;
}

export function ActivityDetailPanel({ event, onClose }: ActivityDetailPanelProps) {
  const navigate = useNavigate();

  if (!event) return null;

  const severity = SEVERITY_CONFIG[event.severity];

  // Build contextual actions based on event type, action, and severity
  const actions = getContextualActions(event, navigate);

  const details: DetailRow[] = [
    { label: 'Timestamp', value: format(new Date(event.timestamp), 'PPpp'), icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" /> },
    { label: 'Category', value: CATEGORY_LABELS[event.category], icon: <FileText className="h-3.5 w-3.5 text-muted-foreground" /> },
    { label: 'Action', value: event.action, icon: ACTION_ICONS[event.action] || <Info className="h-3.5 w-3.5" /> },
  ];

  if (event.actor) {
    details.push({ label: 'Actor', value: event.actor, icon: <User className="h-3.5 w-3.5 text-muted-foreground" /> });
  }
  if (event.resource) {
    details.push({ label: 'Resource', value: event.resource, icon: <FileText className="h-3.5 w-3.5 text-muted-foreground" /> });
  }
  if (event.duration) {
    details.push({ label: 'Duration', value: formatDuration(event.duration), icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" /> });
  }

  return (
    <div className="w-[340px] shrink-0 border-l bg-card animate-slide-in-right flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border', severity.className)}>
            {severity.icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight">{event.title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className={cn('text-[10px] h-5', severity.className)}>
                {severity.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(event.timestamp), 'HH:mm:ss')}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 -mt-0.5" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Description */}
      {event.description && (
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
          <p className="text-sm">{event.description}</p>
        </div>
      )}

      {/* Details */}
      <div className="flex-1 overflow-auto p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Details</p>
        <dl className="space-y-3">
          {details.map((d) => (
            <div key={d.label} className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5">{d.icon}</span>
              <div className="min-w-0">
                <dt className="text-[11px] text-muted-foreground">{d.label}</dt>
                <dd className="text-sm font-mono break-all">{d.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {/* Metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <>
            <Separator className="my-4" />
            <p className="text-xs font-medium text-muted-foreground mb-3">Metadata</p>
            <dl className="space-y-2">
              {Object.entries(event.metadata).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[11px] text-muted-foreground">{key}</dt>
                  <dd className="text-xs font-mono break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Actions</p>
          <div className="flex flex-col gap-1.5">
            {actions.map((a, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="justify-start gap-2 h-8 text-xs"
                onClick={a.onClick}
              >
                {a.icon}
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <p className="text-[10px] text-muted-foreground text-center">
          Event ID: {event.id}
        </p>
      </div>
    </div>
  );
}
