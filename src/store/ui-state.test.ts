import { describe, it, expect, beforeEach } from 'vitest';
import { usePersistedUiStore, useSessionUiStore } from './ui-state';

const PERSIST_KEY = 'oe3-ui-state';

describe('ui-state stores', () => {
  beforeEach(() => {
    localStorage.clear();
    usePersistedUiStore.setState({ values: {} });
    useSessionUiStore.setState({ values: {} });
  });

  it('persists values written to the persisted store', () => {
    usePersistedUiStore.getState().setValue('studies.sorting', [{ id: 'patientName', desc: false }]);
    usePersistedUiStore.getState().setValue('studies.columnSizing', { patientName: 320 });

    const raw = localStorage.getItem(PERSIST_KEY) ?? '';
    expect(raw).toContain('patientName');
    expect(raw).toContain('320');
    expect(raw).toContain('"desc":false');
  });

  it('never writes the memory store to localStorage — it can contain PHI', () => {
    useSessionUiStore.getState().setValue('activity:search', 'ZANDER');
    useSessionUiStore.getState().setValue('remote:queryPatientId', 'PP-26-BA8DD');
    // keep the persisted store non-empty so the assertion is meaningful
    usePersistedUiStore.getState().setValue('studies.sorting', [{ id: 'studyDate', desc: true }]);

    const raw = localStorage.getItem(PERSIST_KEY) ?? '';
    expect(raw).not.toContain('ZANDER');
    expect(raw).not.toContain('PP-26-BA8DD');
    expect(raw).not.toContain('activity:search');
    // the in-memory copy is still there for the next mount
    expect(useSessionUiStore.getState().values['activity:search']).toBe('ZANDER');
  });

  it('keeps the two stores independent', () => {
    usePersistedUiStore.getState().setValue('a', 1);
    useSessionUiStore.getState().setValue('a', 2);
    expect(usePersistedUiStore.getState().values['a']).toBe(1);
    expect(useSessionUiStore.getState().values['a']).toBe(2);
  });
});
