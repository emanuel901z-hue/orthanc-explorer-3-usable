import { describe, it, expect } from 'vitest';
import { distributeColumnWidths, totalTableWidth } from './column-layout';

describe('distributeColumnWidths', () => {
  it('shares the container width proportionally to the size hints', () => {
    const sizing = distributeColumnWidths(
      [
        { id: 'a', size: 100 },
        { id: 'b', size: 300 },
      ],
      800,
    );
    expect(sizing).toEqual({ a: 200, b: 600 });
  });

  it('never goes below minSize', () => {
    const sizing = distributeColumnWidths(
      [
        { id: 'tiny', size: 10, minSize: 200 },
        { id: 'wide', size: 1000 },
      ],
      600,
    );
    expect(sizing.tiny).toBeGreaterThanOrEqual(200);
  });

  it('falls back to the defaults 150 / 60', () => {
    const sizing = distributeColumnWidths([{ id: 'a' }, { id: 'b' }], 600);
    expect(sizing).toEqual({ a: 300, b: 300 });
  });

  it('keeps the minimum widths when the container is too small (table overflows)', () => {
    const sizing = distributeColumnWidths(
      [
        { id: 'a', size: 100, minSize: 200 },
        { id: 'b', size: 100, minSize: 200 },
      ],
      100,
    );
    expect(sizing).toEqual({ a: 200, b: 200 });
  });

  it('returns nothing for no columns', () => {
    expect(distributeColumnWidths([], 800)).toEqual({});
  });

  it('never sums to more than the container — no needless horizontal scrollbar', () => {
    // The real shape of the studies list (measured live): a 40 px checkbox
    // column, six 150 px columns, the viewer column and the status column with
    // a 100 px minimum. Splitting proportionally and then flooring each column
    // at its minimum made the sum 784 for a 718 px container, so the table was
    // wider than its container at *every* width (+66 px at 1024, +21 px at 1440).
    const columns = [
      { id: 'select', size: 40 },
      { id: 'patientName', size: 150 },
      { id: 'studyDate', size: 150 },
      { id: 'modality', size: 150 },
      { id: 'description', size: 150 },
      { id: 'accession', size: 150 },
      { id: 'images', size: 150 },
      { id: 'quickViewer', size: 90 },
      { id: 'status', size: 120, minSize: 100 },
    ];
    const sum = (width: number) =>
      Object.values(distributeColumnWidths(columns, width)).reduce((a, b) => a + b, 0);

    expect(sum(718)).toBe(718);      // 1024 px window with the sidebar
    expect(sum(1134)).toBe(1134);    // 1440 px window
    expect(sum(1600)).toBe(1600);    // nothing left over on a wide screen
  });

  it('still honours the minimums when the container cannot hold them', () => {
    // below the sum of the minimums the table has to overflow — that is the
    // documented boundary, not a rounding accident
    const sizing = distributeColumnWidths(
      [
        { id: 'a', size: 150, minSize: 200 },
        { id: 'b', size: 150, minSize: 200 },
      ],
      300,
    );
    expect(sizing).toEqual({ a: 200, b: 200 });
  });

  it('gives a floored column its minimum without starving the others', () => {
    const sizing = distributeColumnWidths(
      [
        { id: 'status', size: 120, minSize: 100 },
        { id: 'name', size: 150 },
      ],
      400,
    );
    // status would get 178 and keeps it; name takes the rest
    expect(sizing.status).toBeGreaterThanOrEqual(100);
    expect(sizing.status + sizing.name).toBe(400);
  });
});

describe('totalTableWidth', () => {
  it('grows with the columns when they exceed the container', () => {
    expect(totalTableWidth({ a: 700, b: 700 }, 800)).toBe(1400);
  });

  it('never shrinks below the container', () => {
    expect(totalTableWidth({ a: 100, b: 100 }, 800)).toBe(800);
  });
});
