import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronUp,
  ChevronDown,
  Upload,
  Send,
  ShieldCheck,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useJobStore } from '@/store/job-store';
import { Job, JobType } from '@/shared/types/job';
import { useActivityUIStore } from '@/store/activity-ui-store';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<JobType, React.ReactNode> = {
  upload: <Upload className="h-3.5 w-3.5" />,
  send: <Send className="h-3.5 w-3.5" />,
  anonymize: <ShieldCheck className="h-3.5 w-3.5" />,
  modify: <Pencil className="h-3.5 w-3.5" />,
};

const STATUS_ICON: Record<Job['status'], React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  running: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />,
  complete: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  interrupted: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
};

function formatRelativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function JobStatusBar() {
  const { jobs, removeJob, clearCompleted, retryJob } = useJobStore();
  const navigate = useNavigate();
  const setPendingSelectId = useActivityUIStore((s) => s.setPendingSelectId);
  const [expanded, setExpanded] = useState(false);

  if (jobs.length === 0) return null;

  const activeCount = jobs.filter((j) => j.status === 'running' || j.status === 'pending').length;
  const errorCount = jobs.filter((j) => j.status === 'error' || j.status === 'interrupted').length;
  const completedCount = jobs.filter((j) => j.status === 'complete').length;

  const overallProgress =
    jobs.length > 0
      ? jobs.reduce((sum, j) => sum + (j.status === 'complete' ? 100 : j.progress), 0) / jobs.length
      : 0;

  return (
    <div className="border-t bg-background z-40 shrink-0">
      {/* Summary bar — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
      >
        {activeCount > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        ) : errorCount > 0 ? (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        )}

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">
            {activeCount > 0
              ? `${activeCount} job${activeCount > 1 ? 's' : ''} running`
              : errorCount > 0
              ? `${errorCount} job${errorCount > 1 ? 's' : ''} need attention`
              : `${completedCount} job${completedCount > 1 ? 's' : ''} complete`}
          </span>
          {activeCount > 0 && (
            <div className="flex items-center gap-2 min-w-[120px] max-w-[200px]">
              <Progress value={overallProgress} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">{Math.round(overallProgress)}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {completedCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {completedCount} done
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">
              {errorCount} failed
            </Badge>
          )}
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded job list */}
      {expanded && (
        <div className="border-t">
          <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">
              Job Manager · {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={clearCompleted}
              disabled={completedCount === 0}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear completed
            </Button>
          </div>
          <ScrollArea className="max-h-48">
            <div className="divide-y">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setPendingSelectId(job.id); navigate('/activity'); }}
                >
                  <span className="shrink-0" title={job.type}>{TYPE_ICON[job.type]}</span>
                  <span className="shrink-0">{STATUS_ICON[job.status]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{job.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelativeTime(job.updatedAt)}
                      </span>
                    </div>
                    {job.status === 'running' && (
                      <Progress value={job.progress} className="h-1 mt-1" />
                    )}
                    {job.error && (
                      <p className="text-xs text-destructive truncate mt-0.5">{job.error}</p>
                    )}
                    {job.status === 'interrupted' && (
                      <p className="text-xs text-warning mt-0.5">Interrupted — retry to resume</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(job.status === 'error' || job.status === 'interrupted') && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => retryJob(job.id)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    {job.status !== 'running' && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeJob(job.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
