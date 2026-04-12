// PHI classification: SESSION (may hold PHI — memory-only)
// CRITICAL: tab state holds open study IDs (studyId field) — must NOT use persist() middleware.
// TODO: Remove persist() middleware — see PHI hygiene task.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppTab {
  id: string;
  /** The current path rendered in this tab */
  path: string;
  label: string;
  icon?: string;
  closable: boolean;
  /** Groups detail pages under the same tab */
  studyId?: string;
}

const MAX_TABS = 10;

interface TabState {
  tabs: AppTab[];
  activeTabId: string | null;
  openTab: (tab: Omit<AppTab, 'id'>) => string;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  updateTabPath: (id: string, path: string) => void;
  updateTabLabel: (id: string, label: string) => void;
  getTabByStudyId: (studyId: string) => AppTab | undefined;
  getTabByPath: (path: string) => AppTab | undefined;
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (tabData) => {
        const state = get();

        // If this tab has a studyId, check if one already exists for that study
        if (tabData.studyId) {
          const existing = state.tabs.find((t) => t.studyId === tabData.studyId);
          if (existing) {
            set({ activeTabId: existing.id });
            // Update the path to the new one
            set((s) => ({
              tabs: s.tabs.map((t) =>
                t.id === existing.id ? { ...t, path: tabData.path } : t
              ),
            }));
            return existing.id;
          }
        }

        // Check for exact path match (e.g. the pinned Studies tab)
        const exactMatch = state.tabs.find((t) => t.path === tabData.path);
        if (exactMatch) {
          set({ activeTabId: exactMatch.id });
          return exactMatch.id;
        }

        // Enforce max tabs
        if (state.tabs.length >= MAX_TABS) {
          const closable = state.tabs.find((t) => t.closable);
          if (closable) {
            set((s) => ({
              tabs: s.tabs.filter((t) => t.id !== closable.id),
            }));
          } else {
            return state.activeTabId || '';
          }
        }

        const id = generateTabId();
        const newTab: AppTab = { ...tabData, id };
        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (id) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === id);
        if (!tab || !tab.closable) return;

        const idx = state.tabs.findIndex((t) => t.id === id);
        const newTabs = state.tabs.filter((t) => t.id !== id);

        let newActive = state.activeTabId;
        if (state.activeTabId === id) {
          if (newTabs.length > 0) {
            const nextIdx = Math.min(idx, newTabs.length - 1);
            newActive = newTabs[nextIdx].id;
          } else {
            newActive = null;
          }
        }

        set({ tabs: newTabs, activeTabId: newActive });
      },

      activateTab: (id) => {
        set({ activeTabId: id });
      },

      updateTabPath: (id, path) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, path } : t)),
        }));
      },

      updateTabLabel: (id, label) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
        }));
      },

      getTabByStudyId: (studyId) => {
        return get().tabs.find((t) => t.studyId === studyId);
      },

      getTabByPath: (path) => {
        return get().tabs.find((t) => t.path === path);
      },
    }),
    {
      name: 'orthanc-tabs',
    }
  )
);
