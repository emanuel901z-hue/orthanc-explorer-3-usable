import { useMemo } from 'react';
import { format, subHours, subDays, subMinutes } from 'date-fns';
import {
  Download, Send, Shield, Pencil, Upload, Eye, Monitor, CheckCircle2,
  AlertCircle, Clock, ArrowDownToLine, Server
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActivityEntry {
  id: string;
  timestamp: Date;
  type: 'received' | 'stable' | 'sent' | 'anonymized' | 'modified' | 'downloaded' | 'viewed' | 'series_added';
  status: 'success' | 'failed' | 'in_progress';
  title: string;
  description: string;
  user?: string;
  metadata?: Record<string, string>;
}

const ICONS: Record<ActivityEntry['type'], React.ElementType> = {
  received: ArrowDownToLine,
  stable: CheckCircle2,
  sent: Send,
  anonymized: Shield,
  modified: Pencil,
  downloaded: Download,
  viewed: Eye,
  series_added: Upload,
};

const STATUS_STYLES: Record<ActivityEntry['status'], string> = {
  success: 'bg-success/10 text-success border-success/30',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
  in_progress: 'bg-info/10 text-info border-info/30',
};

const TYPE_COLORS: Record<ActivityEntry['type'], string> = {
  received: 'text-info',
  stable: 'text-success',
  sent: 'text-primary',
  anonymized: 'text-accent',
  modified: 'text-warning',
  downloaded: 'text-muted-foreground',
  viewed: 'text-muted-foreground',
  series_added: 'text-info',
};

function generateDemoActivity(): ActivityEntry[] {
  const now = new Date();
  return [
    {
      id: '1',
      timestamp: subMinutes(now, 12),
      type: 'viewed',
      status: 'success',
      title: 'Study opened in viewer',
      description: 'OHIF Viewer session started',
      user: 'Dr. Sarah Chen',
      metadata: { 'Viewer': 'OHIF v3.8', 'Duration': '4m 32s' },
    },
    {
      id: '2',
      timestamp: subHours(now, 2),
      type: 'downloaded',
      status: 'success',
      title: 'Study downloaded',
      description: 'Full study exported as DICOM Part 10',
      user: 'Dr. Sarah Chen',
      metadata: { 'Format': 'DICOM P10', 'Size': '247.3 MB', 'Series included': '4 of 4' },
    },
    {
      id: '3',
      timestamp: subHours(now, 5),
      type: 'sent',
      status: 'failed',
      title: 'C-STORE to PACS_MAIN failed',
      description: 'Connection refused by remote AET',
      metadata: { 'Remote AET': 'PACS_MAIN', 'Host': '10.0.1.50:11112', 'Error': 'Association rejected: No presentation context accepted' },
    },
    {
      id: '4',
      timestamp: subHours(now, 5.1),
      type: 'sent',
      status: 'success',
      title: 'C-STORE to WORKSTATION_RAD3',
      description: 'Sent 4 series (312 instances) to reading workstation',
      user: 'Dr. James Wilson',
      metadata: { 'Remote AET': 'RAD_WS3', 'Host': '10.0.2.15:104', 'Instances sent': '312', 'Duration': '18s' },
    },
    {
      id: '5',
      timestamp: subDays(now, 1),
      type: 'modified',
      status: 'success',
      title: 'DICOM tags modified',
      description: 'Accession number and referring physician updated',
      user: 'Admin',
      metadata: {
        '(0008,0050) Accession Number': 'ACC-2024-0847 → ACC-2024-0848',
        '(0008,0090) Referring Physician': 'DR. SMITH^JOHN → DR. WILSON^JAMES',
      },
    },
    {
      id: '6',
      timestamp: subDays(now, 1.2),
      type: 'anonymized',
      status: 'success',
      title: 'Study anonymized (copy)',
      description: 'New anonymized copy created with modified patient identity',
      user: 'Dr. Sarah Chen',
      metadata: { 'New Patient Name': 'RESEARCH_SUBJ_042', 'New Patient ID': 'RS042', 'Tags removed': '23', 'New Study ID': 'study-anon-0412' },
    },
    {
      id: '7',
      timestamp: subDays(now, 3),
      type: 'stable',
      status: 'success',
      title: 'Study marked stable',
      description: 'No new instances received for 60 seconds',
      metadata: { 'Total series': '4', 'Total instances': '312' },
    },
    {
      id: '8',
      timestamp: subDays(now, 3),
      type: 'series_added',
      status: 'success',
      title: 'Series received: CHEST W/O 1.25mm',
      description: 'Thin-slice reconstruction added via C-STORE',
      metadata: { 'Modality': 'CT', 'Instances': '142', 'Source AET': 'CT_SCANNER_1', 'Series #': '4' },
    },
    {
      id: '9',
      timestamp: subDays(now, 3),
      type: 'series_added',
      status: 'success',
      title: 'Series received: CHEST W/O 5mm',
      description: 'Standard reconstruction received via C-STORE',
      metadata: { 'Modality': 'CT', 'Instances': '64', 'Source AET': 'CT_SCANNER_1', 'Series #': '3' },
    },
    {
      id: '10',
      timestamp: subDays(now, 3.01),
      type: 'series_added',
      status: 'success',
      title: 'Series received: SCOUT',
      description: 'Localizer received via C-STORE',
      metadata: { 'Modality': 'CT', 'Instances': '2', 'Source AET': 'CT_SCANNER_1', 'Series #': '1' },
    },
    {
      id: '11',
      timestamp: subDays(now, 3.02),
      type: 'received',
      status: 'success',
      title: 'Study received via C-STORE',
      description: 'New study stored from CT Scanner 1',
      metadata: { 'Source AET': 'CT_SCANNER_1', 'Source IP': '10.0.3.22', 'Called AET': 'ORTHANC' },
    },
  ];
}

function formatRelative(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, 'MMM d, yyyy');
}

export default function StudyActivityLog() {
  const entries = useMemo(() => generateDemoActivity(), []);

  return (
    <div className="space-y-1">
      {entries.map((entry, idx) => {
        const Icon = ICONS[entry.type];
        const isLast = idx === entries.length - 1;
        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline gutter */}
            <div className="flex flex-col items-center pt-1">
              <div className={cn('rounded-full p-1.5 border bg-background', TYPE_COLORS[entry.type])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-5', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.title}</span>
                    {entry.status === 'failed' && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', STATUS_STYLES.failed)}>
                        <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Failed
                      </Badge>
                    )}
                    {entry.status === 'in_progress' && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', STATUS_STYLES.in_progress)}>
                        <Clock className="h-2.5 w-2.5 mr-0.5" /> In Progress
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground">{formatRelative(entry.timestamp)}</span>
                  <div className="text-[10px] text-muted-foreground/60">{format(entry.timestamp, 'HH:mm:ss')}</div>
                </div>
              </div>

              {/* Metadata */}
              {entry.metadata && (
                <div className="mt-2 rounded-md border bg-muted/30 p-2 space-y-0.5">
                  {Object.entries(entry.metadata).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">{key}:</span>
                      <span className={cn('font-mono text-[11px]', entry.status === 'failed' && key === 'Error' && 'text-destructive')}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {entry.user && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70">
                  <Monitor className="h-2.5 w-2.5" />
                  {entry.user}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
