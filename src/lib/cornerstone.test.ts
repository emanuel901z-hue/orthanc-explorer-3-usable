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
  StackScrollTool: class { static toolName = 'StackScrollMouseWheel'; },
}));
vi.mock('@cornerstonejs/dicom-image-loader', () => ({
  default: { init: vi.fn() },
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

  it('registers exactly the 4 expected tools', async () => {
    const toolsMod = await import('@cornerstonejs/tools');
    await initCornerstone();
    expect(vi.mocked(toolsMod.addTool)).toHaveBeenCalledTimes(4);
  });
});

describe('initCornerstone — isolated scenarios', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks(); // reset spy call counts so toHaveBeenCalledTimes measures this test only
  });

  it('concurrent calls do not double-initialize — csInit runs exactly once', async () => {
    // Import the dep first so its spy is in the cache when cornerstone.ts loads
    const coreMod = await import('@cornerstonejs/core');
    const { initCornerstone: init } = await import('./cornerstone');

    // Two concurrent callers — neither awaited before calling the second
    await Promise.all([init(), init()]);

    // csInit must have been called exactly once despite two concurrent callers
    expect(vi.mocked(coreMod.init)).toHaveBeenCalledTimes(1);
  });

  it('allows retry after a failed init', async () => {
    vi.mock('@cornerstonejs/core', () => ({
      init: vi.fn().mockResolvedValue(undefined),
    }));
    vi.mock('@cornerstonejs/tools', () => ({
      init: vi.fn().mockResolvedValue(undefined),
      addTool: vi.fn(),
      PanTool: class { static toolName = 'Pan'; },
      ZoomTool: class { static toolName = 'Zoom'; },
      WindowLevelTool: class { static toolName = 'WindowLevel'; },
      StackScrollTool: class { static toolName = 'StackScrollMouseWheel'; },
    }));
    vi.mock('@cornerstonejs/dicom-image-loader', () => ({
      default: { init: vi.fn(), configure: vi.fn() },
    }));

    const coreMod = await import('@cornerstonejs/core');
    vi.mocked(coreMod.init).mockRejectedValueOnce(new Error('GPU unavailable'));

    const { initCornerstone: init } = await import('./cornerstone');

    await expect(init()).rejects.toThrow('GPU unavailable');
    // _initPromise should be cleared; next call must succeed
    await expect(init()).resolves.toBeUndefined();
  });
});
