/**
 * UI state that must survive navigation.
 *
 * Why: switching an OE3 tab or view unmounts the page, so plain `useState` lost
 * the chosen filters, columns, widths and view modes every time.
 *
 * Two flavours, one rule:
 *
 *   usePersistedState   → localStorage. **NON-PHI ONLY** (columns, widths, sort
 *                         order, view mode, filters that carry no patient data).
 *                         Survives reloads.
 *   useRememberedState  → memory only. For anything that can contain PHI
 *                         (free-text search, patient/accession filters).
 *                         Survives SPA navigation (tab/view switch) but not a
 *                         reload — same rule as `sessionStore`/`tab-store`.
 *
 * Values are stored one JSON entry per key, so a page can persist several
 * independent settings without a store of its own.
 */
import { useCallback } from 'react';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

const PERSIST_KEY = 'oe3-ui-state';

interface UiValuesState {
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
}

function createValuesStore(): StateCreator<UiValuesState> {
  return (set) => ({
    values: {},
    setValue: (key, value) => set((state) => ({ values: { ...state.values, [key]: value } })),
  });
}

/** Persisted to localStorage — non-PHI only. */
export const usePersistedUiStore = create<UiValuesState>()(
  persist(createValuesStore(), { name: PERSIST_KEY }),
);

/** Memory only — never persisted (PHI-safe). */
export const useSessionUiStore = create<UiValuesState>()(createValuesStore());

/** Minimal shape both stores share, so the hooks can be built once. */
type UiStore = {
  <T>(selector: (state: UiValuesState) => T): T;
};

/** Setter wie bei `useState` — akzeptiert einen Wert ODER eine Updater-Funktion. */
type UiSetter<T> = (value: T | ((prev: T) => T)) => void;

function useUiValue<T>(store: UiStore, key: string, initial: T): [T, UiSetter<T>] {
  const stored = store((s) => s.values[key]);
  const setValue = store((s) => s.setValue);
  const value = (stored === undefined ? initial : stored) as T;
  const set = useCallback<UiSetter<T>>(
    (next) => setValue(key, typeof next === 'function' ? (next as (prev: T) => T)(value) : next),
    [key, setValue, value],
  );
  return [value, set];
}

/** Like `useState`, but kept in localStorage across navigation **and** reloads.
 *  Never put PHI in here. */
export function usePersistedState<T>(key: string, initial: T): [T, UiSetter<T>] {
  return useUiValue(usePersistedUiStore, key, initial);
}

/** Like `useState`, but kept in memory across navigation (not reloads).
 *  Use this for anything that may contain PHI. */
export function useRememberedState<T>(key: string, initial: T): [T, UiSetter<T>] {
  return useUiValue(useSessionUiStore, key, initial);
}
