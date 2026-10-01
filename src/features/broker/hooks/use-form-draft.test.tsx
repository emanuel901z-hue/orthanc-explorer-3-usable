import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDraftPersistence, useUnsavedWarning, loadDraft, saveDraft, clearDraft } from './use-form-draft';
import { NodeFormDialog } from '../components/NodeFormDialog';
import '@/i18n';

describe('form drafts', () => {
  it('ignores and removes a draft that is older than an hour', () => {
    // save with a timestamp two hours in the past
    saveDraft('alt', { name: 'von-gestern' }, Date.now() - 2 * 60 * 60 * 1000);

    expect(loadDraft('alt')).toBeNull();
    expect(sessionStorage.getItem('broker.draft.alt')).toBeNull();   // cleaned up
  });

  it('keeps a draft that is still fresh', () => {
    saveDraft('frisch', { name: 'gerade-eben' }, Date.now() - 5 * 60 * 1000);
    expect(loadDraft<{ name: string }>('frisch')).toEqual({ name: 'gerade-eben' });
  });

  it('treats a leftover from an older build as expired', () => {
    sessionStorage.setItem('broker.draft.legacy', JSON.stringify({ name: 'alt' }));
    expect(loadDraft('legacy')).toBeNull();
    expect(sessionStorage.getItem('broker.draft.legacy')).toBeNull();
  });

  it('stores and restores a value', () => {
    saveDraft('x', { name: 'ris-a' });
    expect(loadDraft<{ name: string }>('x')).toEqual({ name: 'ris-a' });
    clearDraft('x');
    expect(loadDraft('x')).toBeNull();
  });

  it('keeps the draft while the value is dirty', () => {
    const { rerender } = renderHook(
      ({ value, dirty }) => useDraftPersistence('y', value, dirty),
      { initialProps: { value: { a: 1 }, dirty: false } },
    );
    expect(loadDraft('y')).toBeNull();               // nothing typed yet

    rerender({ value: { a: 2 }, dirty: true });
    expect(loadDraft<{ a: number }>('y')).toEqual({ a: 2 });
  });

  it('asks before leaving the page with unsaved changes', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const { rerender } = renderHook(({ dirty }) => useUnsavedWarning(dirty),
      { initialProps: { dirty: false } });
    expect(addEventListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender({ dirty: true });
    expect(addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('restores an unfinished node form after a reload', () => {
    // simulate the reload: the dialog is unmounted and mounted again
    const first = render(
      <NodeFormDialog kind="source" open onOpenChange={vi.fn()} pending={false} onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'mfa-typfehler' } });
    fireEvent.change(screen.getByLabelText(/^host$/i), { target: { value: '10.0.1.77' } });
    first.unmount();

    render(
      <NodeFormDialog kind="source" open onOpenChange={vi.fn()} pending={false} onSubmit={vi.fn()} />,
    );
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('mfa-typfehler');
    expect(screen.getByLabelText(/^host$/i)).toHaveValue('10.0.1.77');
  });

  it('drops the draft when the operator discards it', async () => {
    const onOpenChange = vi.fn();
    render(
      <NodeFormDialog kind="source" open onOpenChange={onOpenChange} pending={false} onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'wegwerfen' } });
    expect(loadDraft('node-source-new')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^discard$/i }));

    expect(loadDraft('node-source-new')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('form drafts — wenn der Browser keinen Speicher hergibt', () => {
  const breakStorage = () => {
    const boom = () => { throw new Error('storage disabled (private mode)'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
  };

  it('reads nothing instead of throwing', () => {
    breakStorage();
    expect(loadDraft('x')).toBeNull();
    vi.restoreAllMocks();
  });

  it('writes nothing instead of throwing — the form still works', () => {
    breakStorage();
    expect(() => saveDraft('x', { a: 1 })).not.toThrow();
    expect(() => clearDraft('x')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('removes an unreadable draft instead of leaving it behind', () => {
    sessionStorage.setItem('broker.draft.kaputt', '{not json');
    expect(loadDraft('kaputt')).toBeNull();
    expect(sessionStorage.getItem('broker.draft.kaputt')).toBeNull();
  });

  it('warns before leaving only while the form is dirty', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedWarning(dirty),
      { initialProps: { dirty: false } });
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    rerender({ dirty: true });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);

    // and the listener is gone again once the form is clean
    rerender({ dirty: false });
    const cleanAgain = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanAgain);
    expect(cleanAgain.defaultPrevented).toBe(false);
  });

  it('drops the draft when the caller says it was saved', () => {
    const { result } = renderHook(() => useDraftPersistence('z', { a: 1 }, true));
    expect(loadDraft('z')).toEqual({ a: 1 });

    act(() => { result.current(); });
    expect(loadDraft('z')).toBeNull();
  });
});
