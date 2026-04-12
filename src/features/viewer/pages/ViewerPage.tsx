import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { X, RotateCcw, ZoomIn, Contrast } from 'lucide-react';
import { useStudy, useStudySeries } from '@/features/studies/hooks/use-studies';
import { formatPatientName } from '@/shared/components/ModalityBadge';
import { SeriesPanel, type SeriesItem } from '@/features/viewer/components/SeriesPanel';
import {
  CornerstoneMultiViewport,
  type Layout,
} from '@/features/viewer/components/CornerstoneMultiViewport';
import type { SeriesInfo } from '@/features/viewer/components/CornerstoneViewport';
import { useViewerTools, type ViewerTool } from '@/features/viewer/hooks/useViewerTools';

export default function ViewerPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();

  const { data: study } = useStudy(studyId!);
  const { data: seriesList } = useStudySeries(studyId!);

  const [layout, setLayout] = useState<Layout>('1x1');
  const [activeSlot, setActiveSlot] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTool, setActiveToolState] = useState<ViewerTool>('windowing');

  // 4 slots max; null = empty
  const [slotSeries, setSlotSeries] = useState<Array<SeriesInfo | null>>([
    null, null, null, null,
  ]);

  const { setActiveTool } = useViewerTools();

  const handleToolChange = (tool: ViewerTool) => {
    setActiveToolState(tool);
    setActiveTool(tool);
  };

  // Map repo Series[] → SeriesPanel SeriesItem[]
  const seriesItems: SeriesItem[] = (seriesList ?? []).map((s) => ({
    id: s.id,
    desc: s.seriesDescription ?? s.modality,
    modality: s.modality,
    slices: s.numberOfInstances,
    studyInstanceUID: study?.studyInstanceUID ?? '',
    seriesInstanceUID: s.seriesInstanceUID,
  }));

  const handleSeriesDrop = (slotIndex: number, series: SeriesItem) => {
    setSlotSeries((prev) => {
      const next = [...prev] as Array<SeriesInfo | null>;
      next[slotIndex] = {
        orthancSeriesId: series.id,
        studyInstanceUID: series.studyInstanceUID,
        seriesInstanceUID: series.seriesInstanceUID,
      };
      return next;
    });
    setActiveSlot(slotIndex);
  };

  const patientLabel = study
    ? `${formatPatientName(study.patientName)} · ${study.studyDescription ?? study.modalities.join('/')}`
    : 'Loading…';

  return (
    <div className="flex flex-col h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#12122a] border-b border-white/10 shrink-0">
        <span className="text-xs text-white/60 truncate flex-1">{patientLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
          onClick={() => navigate(-1)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-3 py-1 bg-[#0e0e22] border-b border-white/10 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'windowing' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white"
              onClick={() => handleToolChange('windowing')}
            >
              <Contrast className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Window / Level</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'pan' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white"
              onClick={() => handleToolChange('pan')}
            >
              {/* Move icon using SVG */}
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
                <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
                <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Pan</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'zoom' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white"
              onClick={() => handleToolChange('zoom')}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white"
              onClick={() => undefined}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Reset view</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 bg-white/20 mx-1" />

        {(['1x1', '2x2', '1x2', '2x1'] as Layout[]).map((l) => (
          <Tooltip key={l}>
            <TooltipTrigger asChild>
              <Button
                variant={layout === l ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-white/70 hover:text-white text-[10px] font-mono"
                onClick={() => setLayout(l)}
              >
                {l}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{l} layout</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* ── Body: series panel + viewport grid ── */}
      <div className="flex flex-1 overflow-hidden">
        <SeriesPanel
          seriesList={seriesItems}
          collapsed={panelCollapsed}
          onToggle={() => setPanelCollapsed((v) => !v)}
        />

        <CornerstoneMultiViewport
          layout={layout}
          slots={slotSeries}
          activeSlot={activeSlot}
          onSlotActivate={setActiveSlot}
          onSeriesDrop={handleSeriesDrop}
        />
      </div>
    </div>
  );
}
