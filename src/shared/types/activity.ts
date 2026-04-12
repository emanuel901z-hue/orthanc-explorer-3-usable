export type ActivityCategory = 'job' | 'audit' | 'log';
export type ActivitySeverity = 'info' | 'warning' | 'error' | 'success';

export interface ActivityEvent {
  id: string;
  timestamp: number;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  description?: string;
  /** e.g. 'upload', 'send', 'delete', 'modify', 'echo', 'system' */
  action: string;
  /** Resource that was acted upon */
  resource?: string;
  /** Who performed the action */
  actor?: string;
  /** Duration in ms for completed operations */
  duration?: number;
  /** Extra metadata */
  metadata?: Record<string, string>;
}
