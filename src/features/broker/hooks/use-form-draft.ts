/**
 * Form drafts that survive a reload or a trip through the browser history.
 *
 * A novice fills in a long form, hits Back (or F5, or closes the tab by
 * accident) and everything is gone — the classic complaint. The draft lives in
 * `sessionStorage` (per tab, gone when the tab closes) and is loaded when the
 * form opens, kept while it differs from the stored values, and dropped once it
 * was saved or explicitly discarded.
 */
import { useCallback, useEffect } from 'react';

function storageKey(key: string): string {
  return `broker.draft.${key}`;
}

/** Read a draft (null when there is none or storage is unavailable). */
export function loadDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    /* private mode without storage — the form still works, just without memory */
  }
}

export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    /* nothing to do */
  }
}

/**
 * Keep the current form value as a draft while it differs from the stored one.
 * `dirty` comes from the caller (it knows what "unchanged" means).
 */
export function useDraftPersistence<T>(key: string, value: T, dirty: boolean) {
  useEffect(() => {
    if (dirty) saveDraft(key, value);
  }, [key, value, dirty]);

  return useCallback(() => clearDraft(key), [key]);
}

/**
 * Ask the browser to confirm before the page is left while there are unsaved
 * changes (reload, tab close, external link).
 */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
