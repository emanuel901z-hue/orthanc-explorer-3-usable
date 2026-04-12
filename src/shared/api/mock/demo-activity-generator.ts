import { ActivityEvent, ActivitySeverity } from '@/shared/types/activity';

const PATIENT_NAMES = [
  'Rodriguez, Richard',
  'Thompson, Robert',
  'Chen, Wei',
  'Müller, Hans',
  'García, María',
  'Sato, Yuki',
  "O'Brien, Sarah",
  'Kim, Joon',
  'Patel, Aisha',
  'Johansson, Erik',
  'Dubois, Pierre',
  'Nakamura, Kenji',
];

const SERVERS = ['Cloud PACS', 'Research Archive', 'Regional Hub', 'AI Pipeline'];
const MODALITIES_LIST = ['CT Scanner Room 1', 'MR-3T', 'CR Unit B', 'US Portable'];

const AUDIT_ACTIONS: Array<{ action: string; titleFn: () => string; severity: ActivitySeverity }> =
  [
    {
      action: 'delete',
      titleFn: () => `Study deleted: ${pick(PATIENT_NAMES)}`,
      severity: 'warning',
    },
    { action: 'modify', titleFn: () => `Study modified: ${pick(PATIENT_NAMES)}`, severity: 'info' },
    {
      action: 'anonymize',
      titleFn: () => `Study anonymized: ${pick(PATIENT_NAMES)}`,
      severity: 'info',
    },
    { action: 'label', titleFn: () => `Label added to ${pick(PATIENT_NAMES)}`, severity: 'info' },
    {
      action: 'download',
      titleFn: () => `Study downloaded: ${pick(PATIENT_NAMES)}`,
      severity: 'info',
    },
  ];

const LOG_ACTIONS: Array<{
  action: string;
  titleFn: () => string;
  severity: ActivitySeverity;
  descFn?: () => string;
}> = [
  {
    action: 'echo',
    titleFn: () => `C-ECHO to ${pick(MODALITIES_LIST)}`,
    severity: 'success',
    descFn: () => 'Echo successful — round-trip 12ms',
  },
  {
    action: 'echo',
    titleFn: () => `C-ECHO to ${pick(MODALITIES_LIST)} failed`,
    severity: 'error',
    descFn: () => 'Connection refused — host unreachable',
  },
  { action: 'system', titleFn: () => 'Orthanc service restarted', severity: 'info' },
  {
    action: 'system',
    titleFn: () => 'Database compaction completed',
    severity: 'info',
    descFn: () => 'Freed 2.4 GB — 12,340 studies indexed',
  },
  {
    action: 'system',
    titleFn: () => 'Storage warning: 85% capacity',
    severity: 'warning',
    descFn: () => '425 GB used of 500 GB total',
  },
  { action: 'system', titleFn: () => 'Plugin loaded: DicomWeb', severity: 'info' },
  { action: 'system', titleFn: () => 'TLS certificate renewed', severity: 'success' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDuration(): number {
  return Math.floor(Math.random() * 120000) + 500;
}

export function generateDemoActivityEvents(count: number = 80): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const ageMs = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000); // last 7 days
    const timestamp = now - ageMs;
    const roll = Math.random();

    let event: ActivityEvent;

    if (roll < 0.35) {
      // Job events (derived from job history)
      const isUpload = Math.random() > 0.4;
      const isSend = !isUpload && Math.random() > 0.5;
      const action = isUpload ? 'upload' : isSend ? 'send' : 'anonymize';
      const success = Math.random() > 0.15;
      const patient = pick(PATIENT_NAMES);

      const studyId = `study-${Math.floor(Math.random() * 20) + 1}`;

      event = {
        id: `activity-${i}`,
        timestamp,
        category: 'job',
        severity: success ? 'success' : 'error',
        title: isUpload
          ? `Upload ${success ? 'completed' : 'failed'}: ${Math.floor(Math.random() * 50 + 1)} files`
          : isSend
            ? `Send ${success ? 'completed' : 'failed'}: ${patient} → ${pick(SERVERS)}`
            : `Anonymize ${success ? 'completed' : 'failed'}: ${patient}`,
        action,
        resource: patient,
        duration: randomDuration(),
        description: success ? undefined : 'Connection timeout after 30s',
        metadata: success ? { 'Study ID': studyId } : undefined,
      };
    } else if (roll < 0.65) {
      // Audit events
      const template = pick(AUDIT_ACTIONS);
      event = {
        id: `activity-${i}`,
        timestamp,
        category: 'audit',
        severity: template.severity,
        title: template.titleFn(),
        action: template.action,
        actor: 'admin',
        duration: randomDuration(),
      };
    } else {
      // Log events
      const template = pick(LOG_ACTIONS);
      event = {
        id: `activity-${i}`,
        timestamp,
        category: 'log',
        severity: template.severity,
        title: template.titleFn(),
        action: template.action,
        description: template.descFn?.(),
      };
    }

    events.push(event);
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}
