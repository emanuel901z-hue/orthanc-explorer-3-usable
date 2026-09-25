import type { SortingState, VisibilityState } from '@tanstack/react-table';

/** Columns hidden out of the box in the studies list. */
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  studyInstanceUID: false,
  lastUpdate: false,
  referringPhysician: false,
};

/** Default sort order of the studies list. */
export const DEFAULT_SORTING: SortingState = [{ id: 'studyDate', desc: true }];
