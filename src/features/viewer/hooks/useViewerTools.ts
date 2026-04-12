import {
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  Enums as ToolEnums,
} from '@cornerstonejs/tools';
import { VIEWER_TOOL_GROUP_ID } from '@/features/viewer/components/CornerstoneMultiViewport';

const { MouseBindings } = ToolEnums;

export type ViewerTool = 'pan' | 'zoom' | 'windowing';

export function useViewerTools() {
  const setActiveTool = (tool: ViewerTool) => {
    const tg = ToolGroupManager.getToolGroup(VIEWER_TOOL_GROUP_ID);
    if (!tg) return;

    // Deactivate all primary-button tools, then activate the selected one
    tg.setToolPassive(PanTool.toolName);
    tg.setToolPassive(ZoomTool.toolName);
    tg.setToolPassive(WindowLevelTool.toolName);

    const toolName =
      tool === 'pan'
        ? PanTool.toolName
        : tool === 'zoom'
          ? ZoomTool.toolName
          : WindowLevelTool.toolName;

    tg.setToolActive(toolName, {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
  };

  return { setActiveTool };
}
