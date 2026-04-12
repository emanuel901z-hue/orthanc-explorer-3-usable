import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabStore } from '@/store/tab-store';

/**
 * Updates the label of the current tab when data is loaded.
 * Call this in detail pages once the entity name is available.
 */
export function useTabLabel(label: string | undefined) {
  const location = useLocation();
  const { tabs, updateTabLabel } = useTabStore();

  useEffect(() => {
    if (!label) return;
    const tab = tabs.find((t) => t.path === location.pathname);
    if (tab && tab.label !== label) {
      updateTabLabel(tab.id, label);
    }
  }, [label, location.pathname]);
}
