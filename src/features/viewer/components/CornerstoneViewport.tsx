import { useEffect, useRef, useState } from 'react';
import { RenderingEngine, Enums, type Types } from '@cornerstonejs/core';
import { ToolGroupManager } from '@cornerstonejs/tools';
import { initCornerstone } from '@/lib/cornerstone';
import { buildWadorsImageId } from '@/lib/cornerstoneImageIds';
import { useSeriesInstances } from '@/features/studies/hooks/use-studies';
import { Loader2 } from 'lucide-react';

const { ViewportType } = Enums;

/** Counter to generate unique engine IDs — must never collide within a session. */
let _engineCounter = 0;

export interface SeriesInfo {
  orthancSeriesId: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
}

export interface CornerstoneViewportProps {
  /** The series to display. Pass null to show an empty black viewport. */
  seriesInfo: SeriesInfo | null;
  toolGroupId: string;
  isActive?: boolean;
  className?: string;
}

/**
 * Single Cornerstone3D WebGL viewport.
 *
 * - Creates a RenderingEngine on mount, destroys it on unmount.
 * - Fetches Instance[] via useSeriesInstances and builds wadors: imageIds.
 * - Joins the shared ToolGroup so toolbar tools apply to all viewports.
 */
export function CornerstoneViewport({
  seriesInfo,
  toolGroupId,
  isActive = false,
  className,
}: CornerstoneViewportProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const viewportIdRef = useRef<string>(`vp-${++_engineCounter}`);
  const [engineReady, setEngineReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const { data: instances, isLoading: instancesLoading } = useSeriesInstances(
    seriesInfo?.orthancSeriesId ?? ''
  );

  // Build sorted imageIds whenever instances arrive
  const imageIds: string[] = (() => {
    if (!instances || !seriesInfo) return [];
    return [...instances]
      .sort((a, b) => a.instanceNumber - b.instanceNumber)
      .map((inst) =>
        buildWadorsImageId({
          studyUID: seriesInfo.studyInstanceUID,
          seriesUID: seriesInfo.seriesInstanceUID,
          instanceUID: inst.sopInstanceUID,
        })
      );
  })();

  // Initialize RenderingEngine once on mount
  useEffect(() => {
    if (!divRef.current) return;
    let mounted = true;
    const viewportId = viewportIdRef.current;
    const engineId = `engine-${viewportId}`;

    initCornerstone()
      .then(() => {
        if (!mounted || !divRef.current) return;

        const engine = new RenderingEngine(engineId);
        engineRef.current = engine;

        const viewportInput: Types.PublicViewportInput = {
          viewportId,
          type: ViewportType.STACK,
          element: divRef.current,
        };
        engine.enableElement(viewportInput);

        // Register with tool group so PanTool, WindowLevelTool etc. apply here
        const tg = ToolGroupManager.getToolGroup(toolGroupId);
        tg?.addViewport(viewportId, engineId);

        if (mounted) setEngineReady(true);
      })
      .catch((err) => {
        if (mounted) setRenderError(err instanceof Error ? err.message : 'Cornerstone init failed');
      });

    return () => {
      mounted = false;
      const engine = engineRef.current;
      if (engine) {
        // removeViewports(renderingEngineId, viewportId?)
        const tg = ToolGroupManager.getToolGroup(toolGroupId);
        tg?.removeViewports(engine.id, viewportIdRef.current);
        engine.destroy();
        engineRef.current = null;
      }
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolGroupId]); // Only re-mount if toolGroupId changes

  // Load/update stack whenever imageIds change
  useEffect(() => {
    if (!engineReady || !engineRef.current || imageIds.length === 0) return;

    const vp = engineRef.current.getViewport(viewportIdRef.current) as Types.IStackViewport;
    vp.setStack(imageIds, 0)
      .then(() => vp.render())
      .catch((err) => setRenderError(err instanceof Error ? err.message : 'Stack load failed'));
  }, [imageIds.join(','), engineReady]); // join gives stable primitive dep

  const isLoading = instancesLoading || (seriesInfo !== null && !engineReady);

  return (
    <div
      className={`relative bg-black overflow-hidden ${className ?? ''}`}
      style={{ minHeight: 300 }}
    >
      {/* Cornerstone renders into this div via WebGL */}
      <div
        ref={divRef}
        style={{ width: '100%', height: '100%' }}
        className={isActive ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : ''}
      />

      {/* Empty state */}
      {!seriesInfo && (
        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs select-none">
          Drag a series here
        </div>
      )}

      {/* Loading */}
      {isLoading && seriesInfo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        </div>
      )}

      {/* Error */}
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-red-400 text-xs p-4 text-center">
          {renderError}
        </div>
      )}
    </div>
  );
}
