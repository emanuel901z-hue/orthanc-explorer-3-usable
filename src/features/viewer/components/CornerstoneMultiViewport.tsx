import { useEffect, useState } from 'react';
import {
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  Enums as ToolEnums,
} from '@cornerstonejs/tools';
import { initCornerstone } from '@/lib/cornerstone';
import { CornerstoneViewport, type SeriesInfo } from './CornerstoneViewport';
import type { SeriesItem } from './SeriesPanel';

const { MouseBindings } = ToolEnums;

export const VIEWER_TOOL_GROUP_ID = 'oe3-viewer-tg';

export type Layout = '1x1' | '2x2' | '1x2' | '2x1';

const GRID_STYLE: Record<Layout, React.CSSProperties> = {
  '1x1': { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' },
  '2x2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
  '1x2': { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' },
  '2x1': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' },
};

const SLOT_COUNT: Record<Layout, number> = {
  '1x1': 1,
  '2x2': 4,
  '1x2': 2,
  '2x1': 2,
};

interface CornerstoneMultiViewportProps {
  layout: Layout;
  /** Indexed 0–3. Null means the slot is empty. */
  slots: Array<SeriesInfo | null>;
  activeSlot: number;
  onSlotActivate: (index: number) => void;
  onSeriesDrop: (slotIndex: number, series: SeriesItem) => void;
}

export function CornerstoneMultiViewport({
  layout,
  slots,
  activeSlot,
  onSlotActivate,
  onSeriesDrop,
}: CornerstoneMultiViewportProps) {
  const [toolGroupReady, setToolGroupReady] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Create shared tool group once on mount
  useEffect(() => {
    let mounted = true;

    initCornerstone().then(() => {
      if (!mounted) return;

      let tg = ToolGroupManager.getToolGroup(VIEWER_TOOL_GROUP_ID);
      if (!tg) {
        tg = ToolGroupManager.createToolGroup(VIEWER_TOOL_GROUP_ID)!;

        tg.addTool(PanTool.toolName);
        tg.addTool(ZoomTool.toolName);
        tg.addTool(WindowLevelTool.toolName);
        tg.addTool(StackScrollTool.toolName);

        // Default: left-click = W/L, middle = pan, right = zoom, wheel = scroll slices
        tg.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        });
        tg.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Auxiliary }],
        });
        tg.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Secondary }],
        });
        tg.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Wheel }],
        });
      }

      if (mounted) setToolGroupReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const count = SLOT_COUNT[layout];

  const handleDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverSlot(slotIndex);
  };

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setDragOverSlot(null);
    try {
      const series: SeriesItem = JSON.parse(e.dataTransfer.getData('application/json'));
      onSeriesDrop(slotIndex, series);
    } catch {
      // Malformed drag data — ignore
    }
  };

  return (
    <div
      className="flex-1 bg-black"
      style={{
        display: 'grid',
        gap: 2,
        minHeight: 500,
        ...GRID_STYLE[layout],
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`relative cursor-pointer ${dragOverSlot === i ? 'outline outline-2 outline-blue-400' : ''}`}
          onClick={() => onSlotActivate(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDragLeave={() => setDragOverSlot(null)}
          onDrop={(e) => handleDrop(e, i)}
        >
          {toolGroupReady && (
            <CornerstoneViewport
              seriesInfo={slots[i] ?? null}
              toolGroupId={VIEWER_TOOL_GROUP_ID}
              isActive={i === activeSlot}
              className="w-full h-full"
            />
          )}
        </div>
      ))}
    </div>
  );
}
