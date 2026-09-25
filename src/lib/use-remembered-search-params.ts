/**
 * Like `useSearchParams()`, but the query string is remembered across navigation.
 *
 * Pages that keep their filters in the URL lost them when leaving and coming
 * back (OE3 tab/view switch navigates to a bare path). This hook mirrors the
 * query into the memory-only UI state (`useRememberedState` — the query can
 * contain PHI, so it is never persisted) and restores it on the next mount.
 *
 * Rules:
 *   - a URL that already carries a query string (deep link) wins over the
 *     remembered one;
 *   - clearing all filters clears the memory too, so they do not come back.
 *
 * @param key Namespace, usually the page (e.g. 'studies').
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRememberedState } from '@/store/ui-state';

export function useRememberedSearchParams(key: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lastQuery, setLastQuery] = useRememberedState(`${key}:query`, '');
  // True between "restore kicked off" and "restored params have landed" — during
  // that window the empty query must not overwrite the memory.
  const pendingRestore = useRef(false);

  useEffect(() => {
    if (searchParams.toString() === '' && lastQuery) {
      pendingRestore.current = true;
      setSearchParams(new URLSearchParams(lastQuery), { replace: true });
    }
    // mount only: the remembered filters are applied exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const query = searchParams.toString();
    if (pendingRestore.current) {
      if (query === '') return;
      pendingRestore.current = false;
    }
    if (query !== lastQuery) setLastQuery(query);
  }, [searchParams, lastQuery, setLastQuery]);

  return [searchParams, setSearchParams] as const;
}
