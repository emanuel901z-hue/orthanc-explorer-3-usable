// PHI classification: UI (no PHI — persist-safe)
import { create } from 'zustand';

interface ActivityUIState {
  /** Job ID to auto-select when navigating to Activity page */
  pendingSelectId: string | null;
  setPendingSelectId: (id: string | null) => void;
}

export const useActivityUIStore = create<ActivityUIState>((set) => ({
  pendingSelectId: null,
  setPendingSelectId: (id) => set({ pendingSelectId: id }),
}));
