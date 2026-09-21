/**
 * Helpers for rendering configuration change-log entries and import plans.
 */
import type { ConfigAuditEntry } from '@/api/broker';

export type FieldDiff = { field: string; before: unknown; after: unknown };

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Fields that differ between two snapshots (including added/removed ones). */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): FieldDiff[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((key) => !same(before?.[key], after?.[key]))
    .map((field) => ({ field, before: before?.[field] ?? null, after: after?.[field] ?? null }));
}

/** Human-readable value for the diff table. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** What changed: created / deleted / updated, plus the affected name. */
export function describeEntry(entry: ConfigAuditEntry): {
  kind: 'create' | 'delete' | 'update';
  name: string;
} {
  const kind = entry.before_json === null ? 'create'
    : entry.after_json === null ? 'delete'
    : 'update';
  const source = (entry.after_json ?? entry.before_json ?? {}) as Record<string, unknown>;
  // no name and no ID (cache/spool/TLS actions have neither) → show the entity
  // kind only; a "#?" is noise, not information
  const name = String(source.name ?? source.key
    ?? (entry.entity_id !== null && entry.entity_id !== undefined ? `#${entry.entity_id}` : ''));
  return { kind, name };
}

/** Query parameters for the change log — pure, so it is unit-testable. */
export function auditQueryParams(
  entity: string,
  limit = 50,
): { entity?: string; limit: number } {
  return entity === 'all' || !entity ? { limit } : { entity, limit };
}
