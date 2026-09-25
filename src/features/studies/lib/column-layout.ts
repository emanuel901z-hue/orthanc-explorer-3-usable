import type { ColumnSizingState } from '@tanstack/react-table';

export interface LayoutColumn {
  id: string;
  /** Weight hint from the column definition (default 150). */
  size?: number;
  /** Lower bound for this column (default 60). */
  minSize?: number;
}

/**
 * Automatic column layout: distributes the available width over the visible
 * columns, proportional to their `size` hints and never below `minSize`.
 *
 * This is only the *basis* — the caller merges the widths the user dragged on
 * top (`{ ...autoSizing, ...userWidths }`), so adjusting one column does not
 * freeze the others, and a window resize keeps re-fitting the rest.
 *
 * If the columns' minimum widths do not fit the container the table overflows
 * (the caller then grows the table width instead of squeezing the columns).
 */
export function distributeColumnWidths(
  columns: LayoutColumn[],
  containerWidth: number,
): ColumnSizingState {
  if (columns.length === 0) return {};

  const weights = columns.map((c) => c.size ?? 150);
  const mins = columns.map((c) => c.minSize ?? 60);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const minSum = mins.reduce((a, b) => a + b, 0);
  const target = Math.max(containerWidth, minSum);

  const sizing: ColumnSizingState = {};
  columns.forEach((column, i) => {
    sizing[column.id] = Math.max(mins[i], Math.round((target * weights[i]) / weightSum));
  });
  return sizing;
}

/** Table width that shows every column: the sum of the widths, never below the container. */
export function totalTableWidth(sizing: ColumnSizingState, containerWidth: number): number {
  const sum = Object.values(sizing).reduce((a, b) => a + b, 0);
  return Math.max(sum, containerWidth);
}
