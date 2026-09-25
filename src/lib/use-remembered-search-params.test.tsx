import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useRememberedSearchParams } from './use-remembered-search-params';
import { useSessionUiStore } from '@/store/ui-state';

const KEY = 'studies';

function Probe() {
  const [searchParams, setSearchParams] = useRememberedSearchParams(KEY);
  return (
    <div>
      <div data-testid="query">{searchParams.toString()}</div>
      <button onClick={() => setSearchParams(new URLSearchParams())}>clear</button>
    </div>
  );
}

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Probe />
    </MemoryRouter>,
  );
}

const query = () => screen.getByTestId('query').textContent;

describe('useRememberedSearchParams', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionUiStore.setState({ values: {} });
  });

  it('restores the last used filters when returning without a query string', () => {
    useSessionUiStore.setState({ values: { [`${KEY}:query`]: 'patientId=P1&labels=urgent' } });
    renderAt('/studies');
    expect(query()).toBe('patientId=P1&labels=urgent');
  });

  it('lets an explicit deep link win and remembers it', () => {
    useSessionUiStore.setState({ values: { [`${KEY}:query`]: 'patientId=OLD' } });
    renderAt('/studies?patientId=NEW');
    expect(query()).toBe('patientId=NEW');
    expect(useSessionUiStore.getState().values[`${KEY}:query`]).toBe('patientId=NEW');
  });

  it('remembers filter changes', () => {
    renderAt('/studies?modality=CT');
    expect(useSessionUiStore.getState().values[`${KEY}:query`]).toBe('modality=CT');
  });

  it('does not bring filters back after they were cleared', () => {
    const { unmount } = renderAt('/studies?patientId=P1');
    expect(useSessionUiStore.getState().values[`${KEY}:query`]).toBe('patientId=P1');

    fireEvent.click(screen.getByText('clear'));
    expect(query()).toBe('');
    expect(useSessionUiStore.getState().values[`${KEY}:query`]).toBe('');
    unmount();

    renderAt('/studies');
    expect(query()).toBe('');
  });

  it('keeps pages apart via the key', () => {
    useSessionUiStore.setState({ values: { 'other:query': 'modality=MR' } });
    renderAt('/studies');
    expect(query()).toBe('');
  });
});
