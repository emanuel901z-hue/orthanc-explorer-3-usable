import { describe, it, expect } from 'vitest';
import { diffFields, formatValue, describeEntry } from './config-diff';
import type { ConfigAuditEntry } from '@/api/broker';

function entry(overrides: Partial<ConfigAuditEntry> = {}): ConfigAuditEntry {
  return {
    id: 1, ts: '2026-09-17T10:00:00Z', actor: 'api', action: 'update.source',
    entity: 'source', entity_id: 1, before_json: null, after_json: null,
    correlation_id: '',
    ...overrides,
  };
}

describe('diffFields', () => {
  it('reports only the changed fields', () => {
    const diffs = diffFields(
      { name: 'ris-a', port: 11114, enabled: true },
      { name: 'ris-a', port: 11199, enabled: true },
    );
    expect(diffs).toEqual([{ field: 'port', before: 11114, after: 11199 }]);
  });

  it('treats added and removed fields as changes', () => {
    const diffs = diffFields({ a: 1 }, { b: 2 });
    expect(diffs.map((d) => d.field).sort()).toEqual(['a', 'b']);
    expect(diffs.find((d) => d.field === 'a')).toMatchObject({ before: 1, after: null });
    expect(diffs.find((d) => d.field === 'b')).toMatchObject({ before: null, after: 2 });
  });

  it('compares nested values (operation lists)', () => {
    const ops = [{ op: 'set', tag: 'PatientID', value: 'X' }];
    expect(diffFields({ operations: ops }, { operations: ops })).toEqual([]);
    expect(diffFields({ operations: ops }, { operations: [] })).toHaveLength(1);
  });

  it('handles missing snapshots', () => {
    expect(diffFields(null, null)).toEqual([]);
    expect(diffFields(null, { name: 'x' })).toEqual([{ field: 'name', before: null, after: 'x' }]);
  });
});

describe('formatValue', () => {
  it('renders scalars, lists and objects', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(true)).toBe('true');
    expect(formatValue(11114)).toBe('11114');
    expect(formatValue(['a', 'b'])).toBe('a, b');
    expect(formatValue({ op: 'set' })).toBe('{"op":"set"}');
  });
});

describe('describeEntry', () => {
  it('classifies create, update and delete', () => {
    expect(describeEntry(entry({ before_json: null, after_json: { name: 'ris-a' } })))
      .toEqual({ kind: 'create', name: 'ris-a' });
    expect(describeEntry(entry({ before_json: { name: 'ris-a' }, after_json: { name: 'ris-a' } })))
      .toEqual({ kind: 'update', name: 'ris-a' });
    expect(describeEntry(entry({ before_json: { name: 'ris-a' }, after_json: null })))
      .toEqual({ kind: 'delete', name: 'ris-a' });
  });

  it('falls back to the key and the row id', () => {
    expect(describeEntry(entry({
      entity: 'setting', before_json: null, after_json: { key: 'echo_interval_s' },
    }))).toEqual({ kind: 'create', name: 'echo_interval_s' });

    expect(describeEntry(entry({ entity_id: 7, before_json: null, after_json: null })))
      .toEqual({ kind: 'create', name: '#7' });
  });
});

describe('describeEntry — entries without a name or ID', () => {
  it('does not invent a "#?" for cache/spool/TLS actions', () => {
    const entry = {
      id: 1, ts: '2026-09-21T10:00:00Z', actor: 'api', action: 'cache.refresh',
      entity: 'cache', entity_id: null, correlation_id: '',
      before_json: null, after_json: { sources: 2 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const { name, kind } = describeEntry(entry);
    expect(name).toBe('');
    expect(name).not.toContain('#');
    expect(kind).toBe('create');
  });

  it('still shows the ID when there is one', () => {
    const entry = {
      id: 2, ts: '2026-09-21T10:00:00Z', actor: 'api', action: 'delete.source',
      entity: 'source', entity_id: 42, correlation_id: '',
      before_json: { host: 'h' }, after_json: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    expect(describeEntry(entry).name).toBe('#42');
  });
});
