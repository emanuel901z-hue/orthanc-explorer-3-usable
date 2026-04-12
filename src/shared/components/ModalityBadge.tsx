import { Study } from '@/shared/types';

const MODALITY_CLASSES: Record<string, string> = {
  CT: 'modality-ct',
  MR: 'modality-mr',
  US: 'modality-us',
  CR: 'modality-cr',
  DX: 'modality-dx',
  PT: 'modality-pt',
  NM: 'modality-nm',
};

export function ModalityBadge({ modality }: { modality: string }) {
  const cls = MODALITY_CLASSES[modality] || 'modality-default';
  return <span className={`modality-badge ${cls}`}>{modality}</span>;
}

export function formatPatientName(name: string): string {
  return name.replace(/\^/g, ', ');
}

export function formatDiskSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}
