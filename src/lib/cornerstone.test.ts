import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock heavy WebGL deps — jsdom has no GPU
vi.mock('@cornerstonejs/core', () => ({
  init: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@cornerstonejs/tools', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  addTool: vi.fn(),
  PanTool: class { static toolName = 'Pan'; },
  ZoomTool: class { static toolName = 'Zoom'; },
  WindowLevelTool: class { static toolName = 'WindowLevel'; },
  StackScrollMouseWheelTool: class { static toolName = 'StackScrollMouseWheel'; },
}));
vi.mock('@cornerstonejs/dicom-image-loader', () => ({
  default: { init: vi.fn(), configure: vi.fn() },
}));

import { initCornerstone, isCornerstoneReady } from './cornerstone';

describe('initCornerstone', () => {
  it('resolves without throwing', async () => {
    await expect(initCornerstone()).resolves.toBeUndefined();
  });

  it('is idempotent — calling twice does not throw', async () => {
    await initCornerstone();
    await expect(initCornerstone()).resolves.toBeUndefined();
  });

  it('reports ready after first call', async () => {
    await initCornerstone();
    expect(isCornerstoneReady()).toBe(true);
  });
});
