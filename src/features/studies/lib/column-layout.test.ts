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
});

describe('totalTableWidth', () => {
  it('grows with the columns when they exceed the container', () => {
    expect(totalTableWidth({ a: 700, b: 700 }, 800)).toBe(1400);
  });

  it('never shrinks below the container', () => {
    expect(totalTableWidth({ a: 100, b: 100 }, 800)).toBe(800);
  });
});
