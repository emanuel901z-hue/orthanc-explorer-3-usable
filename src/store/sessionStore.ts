/**
 * sessionStore — memory-only Zustand store for PHI-carrying UI state.
 *
 * NEVER add persist() middleware here. This store is intentionally ephemeral:
 * data is lost on page reload, which is the correct behavior for PHI.
 */
import { create } from "zustand";

interface SessionState {
  currentStudyId: string | null;
  currentSeriesId: string | null;
  setCurrentStudyId: (id: string | null) => void;
  setCurrentSeriesId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  currentStudyId: null,
  currentSeriesId: null,
  setCurrentStudyId: (id) => set({ currentStudyId: id }),
  setCurrentSeriesId: (id) => set({ currentSeriesId: id }),
}));
