import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTg = vi.hoisted(() => ({
  setToolPassive: vi.fn(),
  setToolActive: vi.fn(),
}));

vi.mock('@cornerstonejs/tools', () => ({
  ToolGroupManager: { getToolGroup: vi.fn().mockReturnValue(mockTg) },
  PanTool: { toolName: 'Pan' },
  ZoomTool: { toolName: 'Zoom' },
  WindowLevelTool: { toolName: 'WindowLevel' },
  Enums: { MouseBindings: { Primary: 1 } },
}));

vi.mock('@/features/viewer/components/CornerstoneMultiViewport', () => ({
  VIEWER_TOOL_GROUP_ID: 'oe3-viewer-tg',
}));

import { renderHook, act } from '@testing-library/react';
import { useViewerTools } from './useViewerTools';

describe('useViewerTools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('setActiveTool(pan) deactivates W/L and Zoom then activates Pan on primary button', () => {
    const { result } = renderHook(() => useViewerTools());
    act(() => result.current.setActiveTool('pan'));

    expect(mockTg.setToolPassive).toHaveBeenCalledWith('WindowLevel');
    expect(mockTg.setToolPassive).toHaveBeenCalledWith('Zoom');
    expect(mockTg.setToolActive).toHaveBeenCalledWith('Pan', {
      bindings: [{ mouseButton: 1 }],
    });
  });

  it('setActiveTool(zoom) activates ZoomTool on primary button', () => {
    const { result } = renderHook(() => useViewerTools());
    act(() => result.current.setActiveTool('zoom'));
    expect(mockTg.setToolActive).toHaveBeenCalledWith('Zoom', expect.any(Object));
  });

  it('setActiveTool(windowing) activates WindowLevelTool on primary button', () => {
    const { result } = renderHook(() => useViewerTools());
    act(() => result.current.setActiveTool('windowing'));
    expect(mockTg.setToolActive).toHaveBeenCalledWith('WindowLevel', expect.any(Object));
  });

  it('does nothing when tool group is not yet registered', async () => {
    const toolsMod = await import('@cornerstonejs/tools');
    vi.mocked(toolsMod.ToolGroupManager.getToolGroup).mockReturnValueOnce(undefined);
    const { result } = renderHook(() => useViewerTools());
    expect(() => act(() => result.current.setActiveTool('pan'))).not.toThrow();
  });
});
