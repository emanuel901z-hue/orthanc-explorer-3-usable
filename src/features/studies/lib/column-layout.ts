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
 *
 * The distribution is a **water-filling**: every column that cannot reach its
 * share gets its minimum, and the rest share what is left. The obvious
 * alternative — split proportionally, then floor each column at its minimum —
 * leaves the sum *above* the container whenever a column hits its floor, so the
 * table was always a little wider than its container and showed a horizontal
 * scrollbar even on a wide screen (measured: +66 px at 1024, +21 px at 1440).
 */
export function distributeColumnWidths(
  columns: LayoutColumn[],
  containerWidth: number,
): ColumnSizingState {
  if (columns.length === 0) return {};

  const weights = columns.map((c) => c.size ?? 150);
  const mins = columns.map((c) => c.minSize ?? 60);
  const minSum = mins.reduce((a, b) => a + b, 0);
  const target = Math.max(containerWidth, minSum);

  const sizing: ColumnSizingState = {};
  const fixed: boolean[] = columns.map(() => false);
  let remaining = target;
  let weightSum = weights.reduce((a, b) => a + b, 0);

  // Columns whose proportional share would fall below their minimum are pinned
  // to that minimum; repeat until every remaining column can reach its share.
  for (;;) {
    const flexible = columns.map((_, i) => i).filter((i) => !fixed[i]);
    if (flexible.length === 0) break;
    const share = weightSum > 0 ? remaining / weightSum : 0;
    const below = flexible.filter((i) => weights[i] * share < mins[i]);
    if (below.length === 0) break;
    below.forEach((i) => {
      fixed[i] = true;
      sizing[columns[i].id] = mins[i];
      remaining -= mins[i];
      weightSum -= weights[i];
    });
  }

  const flexible = columns.map((_, i) => i).filter((i) => !fixed[i]);
  if (flexible.length === 0) return sizing;

  // Floor first, then hand out the leftover pixels so the sum is *exactly* the
  // target — a single pixel too many already shows a scrollbar.
  const share = remaining / weightSum;
  const widths = flexible.map((i) => Math.floor(weights[i] * share));
  let leftover = Math.round(remaining) - widths.reduce((a, b) => a + b, 0);
  for (let k = 0; leftover > 0 && k < flexible.length * 1000; k += 1, leftover -= 1) {
    widths[k % flexible.length] += 1;
  }
  flexible.forEach((i, k) => {
    sizing[columns[i].id] = Math.max(1, widths[k]);
  });
  return sizing;
}

/** Table width that shows every column: the sum of the widths, never below the container. */
export function totalTableWidth(sizing: ColumnSizingState, containerWidth: number): number {
  const sum = Object.values(sizing).reduce((a, b) => a + b, 0);
  return Math.max(sum, containerWidth);
}
