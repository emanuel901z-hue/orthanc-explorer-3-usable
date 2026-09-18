/**
 * Form drafts that survive a reload or a trip through the browser history.
 *
 * A novice fills in a long form, hits Back (or F5, or closes the tab by
 * accident) and everything is gone — the classic complaint. The draft lives in
 * `sessionStorage` (per tab, gone when the tab closes) and is loaded when the
 * form opens, kept while it differs from the stored values, and dropped once it
 * was saved or explicitly discarded.
 *
 * Drafts expire after an hour: an unfinished form from yesterday would only
 * confuse ("why is this field already filled?").
 */
import { useCallback, useEffect } from 'react';

/** How long an unfinished draft stays useful. */
export const DRAFT_TTL_MS = 60 * 60 * 1000;   // one hour

type Envelope<T> = { value: T; savedAt: number };

function storageKey(key: string): string {
  return `broker.draft.${key}`;
}

/**
 * Read a draft (null when there is none, it is too old, or storage is
 * unavailable). An expired draft is removed on the way out.
 */
export function loadDraft<T>(key: string, now = Date.now()): T | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as Envelope<T> | T;
    // an envelope carries its timestamp; anything else is a leftover from an
    // older build and is treated as expired
    if (typeof parsed !== 'object' || parsed === null
        || !('savedAt' in parsed) || !('value' in parsed)) {
      clearDraft(key);
      return null;
    }
    const envelope = parsed as Envelope<T>;
    if (now - envelope.savedAt > DRAFT_TTL_MS) {
      clearDraft(key);
      return null;
    }
    return envelope.value;
  } catch {
    clearDraft(key);
    return null;
  }
}

export function saveDraft<T>(key: string, value: T, now = Date.now()): void {
  try {
    const envelope: Envelope<T> = { value, savedAt: now };
    sessionStorage.setItem(storageKey(key), JSON.stringify(envelope));
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
