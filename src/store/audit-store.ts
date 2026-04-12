// PHI classification: SESSION (may hold PHI — memory-only)
// Audit events may reference study IDs and patient-identifying context.
import { create } from 'zustand';
import { ActivityEvent } from '@/shared/types/activity';

interface AuditStore {
  events: ActivityEvent[];
  log: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

let counter = 0;

export const useAuditStore = create<AuditStore>((set) => ({
  events: [],
  log: (event) =>
    set((state) => ({
      events: [
        {
          ...event,
          id: `audit-live-${++counter}`,
          timestamp: Date.now(),
        },
        ...state.events,
      ],
    })),
  clear: () => set({ events: [] }),
}));
