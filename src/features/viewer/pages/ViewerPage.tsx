import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  X, RotateCcw, Grid2X2, Maximize2, ZoomIn, ZoomOut,
  Move, Contrast, Ruler, CircleDot, FlipHorizontal, FlipVertical,
  LayoutGrid, MousePointer, Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudy, useStudySeries } from '@/features/studies/hooks/use-studies';
import { formatPatientName } from '@/shared/components/ModalityBadge';
import { SeriesPanel, type SeriesItem } from '@/features/viewer/components/SeriesPanel';

type Tool = 'pan' | 'zoom' | 'windowing' | 'measure' | 'crosshair';
type Layout = '1x1' | '2x2' | '1x2' | '2x1';

interface ViewportState {
  windowCenter: number;
  windowWidth: number;
  zoom: number;
  pan: { x: number; y: number };
  flipH: boolean;
  flipV: boolean;
  sliceIndex: number;
  totalSlices: number;
  seriesDescription: string;
  modality: string;
  sequence?: string;
}

const DEFAULT_WL: Record<string, { wc: number; ww: number }> = {
  'LUNG': { wc: -600, ww: 1500 },
  'SOFT TISSUE': { wc: 40, ww: 400 },
  'BONE': { wc: 400, ww: 1800 },
  'BRAIN': { wc: 40, ww: 80 },
  'T1': { wc: 500, ww: 1000 },
  'T2': { wc: 400, ww: 800 },
  'FLAIR': { wc: 450, ww: 900 },
};

// Generate a procedural MRI brain slice
function generateMRISlice(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sliceIndex: number,
  totalSlices: number,
  wc: number,
  ww: number,
  zoom: number,
  pan: { x: number; y: number },
  flipH: boolean,
  flipV: boolean,
  sequence: string,
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  const cx = width / 2 + pan.x;
  const cy = height / 2 + pan.y;
  ctx.translate(cx, cy);
  ctx.scale(zoom * (flipH ? -1 : 1), zoom * (flipV ? -1 : 1));
  ctx.translate(-cx, -cy);

  const size = Math.min(width, height) * 0.8;
  const ox = (width - size) / 2;
  const oy = (height - size) / 2;
  const imageData = ctx.createImageData(Math.ceil(size), Math.ceil(size));
  const data = imageData.data;
  const r = size / 2;
  const depthFactor = Math.sin((sliceIndex / totalSlices) * Math.PI);
  const isT1 = sequence.includes('T1');
  const isFLAIR = sequence.includes('FLAIR');

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - r;
      const dy = y - r;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * Math.ceil(size) + x) * 4;

      if (dist > r * 0.85 * depthFactor + r * 0.1) {
        data[idx] = data[idx + 1] = data[idx + 2] = 0;
        data[idx + 3] = 255;
        continue;
      }

      let signal = 0;
      const skullOuter = r * 0.85 * depthFactor + r * 0.1;
      const skullInner = skullOuter - r * 0.04;

      // Skull — low on T1/T2, low on FLAIR
      if (dist > skullInner && dist <= skullOuter) {
        signal = isT1 ? 100 : 50;
      }
      // CSF space (outer)
      else if (dist > skullInner - r * 0.015 && dist <= skullInner) {
        signal = isT1 ? 80 : isFLAIR ? 60 : 900;
      }
      // Brain parenchyma
      else {
        // Gray matter (cortex) — bright on T2, mid on T1
        const cortexThickness = r * 0.06;
        const cortexBoundary = skullInner - r * 0.015;
        if (dist > cortexBoundary - cortexThickness) {
          signal = isT1 ? 550 + Math.random() * 40 : 700 + Math.random() * 40;
        } else {
          // White matter — bright on T1, darker on T2
          signal = isT1 ? 750 + Math.random() * 30 : 450 + Math.random() * 30;

          // Lateral ventricles (butterfly shape)
          const ventY = r - r * 0.05;
          const ventSpread = r * 0.12 * depthFactor;
          const ventHeight = r * 0.08 * depthFactor;
          for (const side of [-1, 1]) {
            const vx = r + side * ventSpread;
            const vdx = (x - vx) / (r * 0.07);
            const vdy = (y - ventY) / ventHeight;
            if (vdx * vdx + vdy * vdy < 1) {
              signal = isT1 ? 80 : isFLAIR ? 60 : 900; // CSF
            }
          }

          // Central structures (thalamus/basal ganglia)
          const centralDist = Math.sqrt((x - r) ** 2 + (y - r) ** 2);
          if (centralDist < r * 0.12 * depthFactor + r * 0.03) {
            signal = isT1 ? 500 + Math.random() * 30 : 600 + Math.random() * 30;
          }

          // Falx cerebri (midline)
          if (Math.abs(x - r) < r * 0.005 && y < r) {
            signal = isT1 ? 100 : 50;
          }
        }
      }

      // Apply window/level
      const minS = wc - ww / 2;
      const maxS = wc + ww / 2;
      let pixel = ((signal - minS) / (maxS - minS)) * 255;
      pixel = Math.max(0, Math.min(255, pixel));
      data[idx] = pixel;
      data[idx + 1] = pixel;
      data[idx + 2] = pixel;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, ox + pan.x, oy + pan.y);
  ctx.restore();
}

// Generate a procedural medical-looking grayscale image (CT)
function generateDemoSlice(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sliceIndex: number,
  totalSlices: number,
  wc: number,
  ww: number,
  zoom: number,
  pan: { x: number; y: number },
  flipH: boolean,
  flipV: boolean,
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  const cx = width / 2 + pan.x;
  const cy = height / 2 + pan.y;
  ctx.translate(cx, cy);
  ctx.scale(zoom * (flipH ? -1 : 1), zoom * (flipV ? -1 : 1));
  ctx.translate(-cx, -cy);

  // Simulate a CT cross-section
  const size = Math.min(width, height) * 0.8;
  const ox = (width - size) / 2;
  const oy = (height - size) / 2;
  const imageData = ctx.createImageData(Math.ceil(size), Math.ceil(size));
  const data = imageData.data;
  const r = size / 2;
  const depthFactor = Math.sin((sliceIndex / totalSlices) * Math.PI);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - r;
      const dy = y - r;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * Math.ceil(size) + x) * 4;

      if (dist > r) {
        data[idx] = data[idx + 1] = data[idx + 2] = 0;
        data[idx + 3] = 255;
        continue;
      }

      // Body outline
      let hu = -800; // air

      // Skin/fat ring
      if (dist < r && dist > r * 0.92) {
        hu = -80 + Math.random() * 20;
      }
      // Soft tissue
      else if (dist < r * 0.92) {
        hu = 30 + Math.random() * 30;

        // Spine (posterior midline)
        const spineX = r;
        const spineY = r + r * 0.25;
        const spineDist = Math.sqrt((x - spineX) ** 2 + (y - spineY) ** 2);
        if (spineDist < r * 0.08 * depthFactor + r * 0.04) {
          hu = 800 + Math.random() * 200; // cortical bone
        } else if (spineDist < r * 0.15) {
          hu = 200 + Math.random() * 100; // cancellous bone
        }

        // Lungs (bilateral air-filled structures)
        const lungOffsetX = r * 0.28;
        const lungY = r - r * 0.05;
        const lungRx = r * 0.22 * depthFactor + r * 0.05;
        const lungRy = r * 0.3 * depthFactor + r * 0.05;

        const leftLungDx = (x - (r - lungOffsetX)) / lungRx;
        const leftLungDy = (y - lungY) / lungRy;
        const rightLungDx = (x - (r + lungOffsetX)) / lungRx;
        const rightLungDy = (y - lungY) / lungRy;

        if (leftLungDx * leftLungDx + leftLungDy * leftLungDy < 1) {
          hu = -750 + Math.random() * 100; // lung parenchyma
          // Vessels in lung
          const vAngle = Math.atan2(leftLungDy, leftLungDx) + sliceIndex * 0.1;
          if (Math.abs(Math.sin(vAngle * 8 + x * 0.05)) < 0.08) {
            hu = 40 + Math.random() * 20;
          }
        }
        if (rightLungDx * rightLungDx + rightLungDy * rightLungDy < 1) {
          hu = -750 + Math.random() * 100;
          const vAngle = Math.atan2(rightLungDy, rightLungDx) + sliceIndex * 0.1;
          if (Math.abs(Math.sin(vAngle * 8 + x * 0.05)) < 0.08) {
            hu = 40 + Math.random() * 20;
          }
        }

        // Heart (mediastinal structure)
        const heartX = r - r * 0.05;
        const heartY = r + r * 0.05;
        const heartR = r * 0.18 * depthFactor + r * 0.06;
        const heartDist = Math.sqrt((x - heartX) ** 2 + (y - heartY) ** 2);
        if (heartDist < heartR) {
          hu = 45 + Math.random() * 15; // myocardium
          if (heartDist < heartR * 0.5) {
            hu = 30 + Math.random() * 10; // chamber blood
          }
        }

        // Ribs (elliptical bone structures)
        const ribAngle = Math.atan2(y - r, x - r);
        const ribR = r * 0.88;
        const ribThickness = r * 0.035;
        if (Math.abs(dist - ribR) < ribThickness) {
          const ribInterval = Math.PI / 6;
          const ribPhase = (ribAngle + Math.PI) % ribInterval;
          if (ribPhase < ribInterval * 0.35) {
            hu = 600 + Math.random() * 300;
          }
        }
      }

      // Apply window/level
      const minHU = wc - ww / 2;
      const maxHU = wc + ww / 2;
      let pixel = ((hu - minHU) / (maxHU - minHU)) * 255;
      pixel = Math.max(0, Math.min(255, pixel));

      data[idx] = pixel;
      data[idx + 1] = pixel;
      data[idx + 2] = pixel;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, ox + pan.x, oy + pan.y);
  ctx.restore();
}

function ViewportOverlay({ state, index }: { state: ViewportState; index: number }) {
  return (
    <>
      {/* Top-left: Patient/Series info */}
      <div className="absolute top-2 left-2 z-10 text-white text-[10px] leading-tight font-mono space-y-0.5 pointer-events-none">
        <div className="text-white/90">{state.seriesDescription}</div>
        <div className="text-white/60">{state.modality}</div>
      </div>
      {/* Top-right: Slice info */}
      <div className="absolute top-2 right-2 z-10 text-white text-[10px] font-mono text-right pointer-events-none">
        <div className="text-white/60">Im: {state.sliceIndex + 1}/{state.totalSlices}</div>
      </div>
      {/* Bottom-left: WL info */}
      <div className="absolute bottom-2 left-2 z-10 text-white text-[10px] font-mono pointer-events-none">
        <div className="text-white/60">W: {state.windowWidth} L: {state.windowCenter}</div>
      </div>
      {/* Bottom-right: Zoom */}
      <div className="absolute bottom-2 right-2 z-10 text-white text-[10px] font-mono pointer-events-none">
        <div className="text-white/60">Zoom: {(state.zoom * 100).toFixed(0)}%</div>
      </div>
    </>
  );
}

const SERIES_DEMOS_CT: SeriesItem[] = [
  { id: 'ct-1', desc: 'CHEST W/O 5mm', modality: 'CT', slices: 64 },
  { id: 'ct-2', desc: 'CHEST W/O 1.25mm', modality: 'CT', slices: 142 },
  { id: 'ct-3', desc: 'LUNG WINDOW 5mm', modality: 'CT', slices: 64 },
  { id: 'ct-4', desc: 'BONE WINDOW 5mm', modality: 'CT', slices: 64 },
  { id: 'ct-5', desc: 'MEDIASTINUM 3mm', modality: 'CT', slices: 96 },
  { id: 'ct-6', desc: 'COR REFORMAT 3mm', modality: 'CT', slices: 48 },
  { id: 'ct-7', desc: 'SAG REFORMAT 3mm', modality: 'CT', slices: 36 },
];

const SERIES_DEMOS_MR: SeriesItem[] = [
  { id: 'mr-1', desc: 'SAG T1 SE', modality: 'MR', slices: 24, sequence: 'T1' },
  { id: 'mr-2', desc: 'AX T2 FSE', modality: 'MR', slices: 36, sequence: 'T2' },
  { id: 'mr-3', desc: 'AX FLAIR', modality: 'MR', slices: 36, sequence: 'FLAIR' },
  { id: 'mr-4', desc: 'AX DWI b1000', modality: 'MR', slices: 28, sequence: 'T2' },
  { id: 'mr-5', desc: 'COR T2 FSE', modality: 'MR', slices: 24, sequence: 'T2' },
  { id: 'mr-6', desc: 'SAG T2 FSE', modality: 'MR', slices: 20, sequence: 'T2' },
  { id: 'mr-7', desc: 'AX T1 POST', modality: 'MR', slices: 36, sequence: 'T1' },
];

export default function ViewerPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();
  const { data: study } = useStudy(studyId!);
  const { data: series = [] } = useStudySeries(studyId!);

  const [layout, setLayout] = useState<Layout>('2x2');
  const [activeTool, setActiveTool] = useState<Tool>('windowing');
  const [activeViewport, setActiveViewport] = useState(0);
  const [linkedViewports, setLinkedViewports] = useState(false);
  const [seriesPanelCollapsed, setSeriesPanelCollapsed] = useState(false);
  const [dropTargetVP, setDropTargetVP] = useState<number | null>(null);
  const isMR = study?.modalities?.some(m => m === 'MR') ?? false;
  const defaultPreset = isMR ? 'T1' : 'SOFT TISSUE';
  const [wlPreset, setWlPreset] = useState(defaultPreset);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);
  const animRef = useRef<number>();

  const viewportCount = layout === '2x2' ? 4 : layout === '1x2' ? 2 : layout === '2x1' ? 2 : 1;
  const gridCols = layout === '2x2' ? 2 : layout === '1x2' ? 2 : 1;

  const seriesDemos = isMR ? SERIES_DEMOS_MR : SERIES_DEMOS_CT;
  const allSeries = isMR ? SERIES_DEMOS_MR : SERIES_DEMOS_CT;
  const defaultWL = DEFAULT_WL[defaultPreset];

  const [viewports, setViewports] = useState<ViewportState[]>(() =>
    seriesDemos.slice(0, 4).map((s, i) => ({
      windowCenter: defaultWL.wc,
      windowWidth: defaultWL.ww,
      zoom: 1,
      pan: { x: 0, y: 0 },
      flipH: false,
      flipV: false,
      sliceIndex: Math.floor(s.slices * 0.45) + i * 3,
      totalSlices: s.slices,
      seriesDescription: s.desc,
      modality: s.modality,
      sequence: s.sequence,
    }))
  );

  // Drop a series onto a viewport
  const handleDrop = (vpIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetVP(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as SeriesItem;
      const preset = DEFAULT_WL[wlPreset] || DEFAULT_WL['SOFT TISSUE'];
      setViewports((prev) => {
        const next = [...prev];
        next[vpIdx] = {
          windowCenter: preset.wc,
          windowWidth: preset.ww,
          zoom: 1,
          pan: { x: 0, y: 0 },
          flipH: false,
          flipV: false,
          sliceIndex: Math.floor(data.slices * 0.45),
          totalSlices: data.slices,
          seriesDescription: data.desc,
          modality: data.modality,
          sequence: data.sequence,
        };
        return next;
      });
    } catch { /* ignore invalid drops */ }
  };

  // Render all canvases
  const renderAll = useCallback(() => {
    for (let i = 0; i < viewportCount; i++) {
      const canvas = canvasRefs.current[i];
      const state = viewports[i];
      if (!canvas || !state) continue;

      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      if (state.modality === 'MR') {
        generateMRISlice(
          ctx, canvas.width, canvas.height,
          state.sliceIndex, state.totalSlices,
          state.windowCenter, state.windowWidth,
          state.zoom, state.pan, state.flipH, state.flipV,
          state.sequence || 'T1'
        );
      } else {
        generateDemoSlice(
          ctx, canvas.width, canvas.height,
          state.sliceIndex, state.totalSlices,
          state.windowCenter, state.windowWidth,
          state.zoom, state.pan, state.flipH, state.flipV
        );
      }
    }
  }, [viewports, viewportCount]);

  useEffect(() => {
    renderAll();
  }, [renderAll]);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(() => renderAll());
    canvasRefs.current.forEach((c) => c && observer.observe(c));
    return () => observer.disconnect();
  }, [renderAll]);

  // Mouse interaction handlers
  const dragRef = useRef<{ startX: number; startY: number; startWC: number; startWW: number; startPanX: number; startPanY: number } | null>(null);

  const handleMouseDown = (vpIdx: number, e: React.MouseEvent) => {
    setActiveViewport(vpIdx);
    const state = viewports[vpIdx];
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWC: state.windowCenter,
      startWW: state.windowWidth,
      startPanX: state.pan.x,
      startPanY: state.pan.y,
    };
  };

  const handleMouseMove = (vpIdx: number, e: React.MouseEvent) => {
    if (!dragRef.current || vpIdx !== activeViewport) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    setViewports((prev) => {
      const next = [...prev];
      const vp = { ...next[vpIdx] };
      if (activeTool === 'windowing') {
        vp.windowWidth = Math.max(1, dragRef.current!.startWW + dx * 2);
        vp.windowCenter = dragRef.current!.startWC + dy * 2;
      } else if (activeTool === 'pan') {
        vp.pan = { x: dragRef.current!.startPanX + dx, y: dragRef.current!.startPanY + dy };
      }
      next[vpIdx] = vp;
      return next;
    });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const handleWheel = (vpIdx: number, e: React.WheelEvent) => {
    e.preventDefault();
    setViewports((prev) => {
      const next = [...prev];
      const vp = { ...next[vpIdx] };
      if (activeTool === 'zoom' || e.ctrlKey) {
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        vp.zoom = Math.max(0.2, Math.min(8, vp.zoom * delta));
      } else {
        // Scroll through slices
        const dir = e.deltaY > 0 ? 1 : -1;
        vp.sliceIndex = Math.max(0, Math.min(vp.totalSlices - 1, vp.sliceIndex + dir));
        // If linked, sync to all viewports
        if (linkedViewports) {
          for (let j = 0; j < next.length; j++) {
            next[j] = { ...next[j], sliceIndex: Math.max(0, Math.min(next[j].totalSlices - 1, next[j].sliceIndex + dir)) };
          }
          return next;
        }
      }
      next[vpIdx] = vp;
      return next;
    });
  };

  const resetAll = () => {
    const preset = DEFAULT_WL[wlPreset] || DEFAULT_WL['SOFT TISSUE'];
    setViewports((prev) =>
      prev.map((vp, i) => ({
        ...vp,
        windowCenter: preset.wc,
        windowWidth: preset.ww,
        zoom: 1,
        pan: { x: 0, y: 0 },
        flipH: false,
        flipV: false,
        sliceIndex: Math.floor(vp.totalSlices * 0.45) + i * 3,
      }))
    );
  };

  const applyPreset = (name: string) => {
    const preset = DEFAULT_WL[name];
    if (!preset) return;
    setWlPreset(name);
    setViewports((prev) =>
      prev.map((vp) => ({ ...vp, windowCenter: preset.wc, windowWidth: preset.ww }))
    );
  };

  const toolButtons: { tool: Tool; icon: React.ElementType; label: string }[] = [
    { tool: 'windowing', icon: Contrast, label: 'Window/Level' },
    { tool: 'pan', icon: Move, label: 'Pan' },
    { tool: 'zoom', icon: ZoomIn, label: 'Zoom' },
    { tool: 'measure', icon: Ruler, label: 'Measure' },
    { tool: 'crosshair', icon: CircleDot, label: 'Crosshair' },
  ];

  const patientName = study ? formatPatientName(study.patientName) : 'Loading…';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a2e] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          {/* Patient info */}
          <div className="text-white text-sm font-medium">{patientName}</div>
          {study && (
            <Badge variant="outline" className="text-[10px] text-white/60 border-white/20">
              {study.modalities.join(' / ')}
            </Badge>
          )}
          <Separator orientation="vertical" className="h-5 bg-white/20" />

          {/* Tools */}
          {toolButtons.map(({ tool, icon: Icon, label }) => (
            <Tooltip key={tool}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10',
                    activeTool === tool && 'bg-white/20 text-white'
                  )}
                  onClick={() => setActiveTool(tool)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-5 bg-white/20" />

          {/* Flip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => setViewports(prev => prev.map((vp, i) => i === activeViewport ? { ...vp, flipH: !vp.flipH } : vp))}
              >
                <FlipHorizontal className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Flip H</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => setViewports(prev => prev.map((vp, i) => i === activeViewport ? { ...vp, flipV: !vp.flipV } : vp))}
              >
                <FlipVertical className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Flip V</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 bg-white/20" />

          {/* W/L presets */}
          {Object.keys(DEFAULT_WL).map((name) => (
            <Button
              key={name}
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 px-2 text-[10px] text-white/50 hover:text-white hover:bg-white/10',
                wlPreset === name && 'bg-white/15 text-white'
              )}
              onClick={() => applyPreset(name)}
            >
              {name}
            </Button>
          ))}

          <Separator orientation="vertical" className="h-5 bg-white/20" />

          {/* Link viewports */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className={cn('h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10', linkedViewports && 'bg-white/20 text-white')}
                onClick={() => setLinkedViewports(!linkedViewports)}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Link All Viewports</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 bg-white/20" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className={cn('h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10', layout === '1x1' && 'bg-white/20 text-white')}
                onClick={() => setLayout('1x1')}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">1×1</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className={cn('h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10', layout === '2x2' && 'bg-white/20 text-white')}
                onClick={() => setLayout('2x2')}
              >
                <Grid2X2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">2×2</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-[10px] text-white/50 hover:text-white hover:bg-white/10"
            onClick={resetAll}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2 text-[10px] text-white/50 hover:text-white hover:bg-white/10"
                onClick={() => navigate(`/studies/${studyId}`)}
              >
                Back to Study
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Return to study detail</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => navigate(`/studies/${studyId}`)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Series panel + Viewport grid */}
      <div className="flex-1 flex overflow-hidden">
        <SeriesPanel
          seriesList={allSeries}
          collapsed={seriesPanelCollapsed}
          onToggle={() => setSeriesPanelCollapsed(!seriesPanelCollapsed)}
        />

        {/* Viewport grid */}
        <div
          className="flex-1 bg-black"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: '1px',
          }}
        >
          {Array.from({ length: viewportCount }).map((_, i) => {
            const state = viewports[i];
            if (!state) return <div key={i} className="bg-[#111]" />;
            return (
              <div
                key={i}
                className={cn(
                  'relative bg-black overflow-hidden transition-shadow',
                  i === activeViewport && viewportCount > 1 && 'ring-1 ring-primary ring-inset',
                  dropTargetVP === i && 'ring-2 ring-blue-400 ring-inset'
                )}
                onClick={() => setActiveViewport(i)}
                onDragOver={(e) => { e.preventDefault(); setDropTargetVP(i); }}
                onDragLeave={() => setDropTargetVP(null)}
                onDrop={(e) => handleDrop(i, e)}
              >
                <canvas
                  ref={(el) => { canvasRefs.current[i] = el; }}
                  className="w-full h-full"
                  style={{ cursor: activeTool === 'pan' ? 'grab' : activeTool === 'zoom' ? 'zoom-in' : 'crosshair' }}
                  onMouseDown={(e) => handleMouseDown(i, e)}
                  onMouseMove={(e) => handleMouseMove(i, e)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={(e) => handleWheel(i, e)}
                />

                {/* Drop overlay */}
                {dropTargetVP === i && (
                  <div className="absolute inset-0 bg-blue-400/10 border-2 border-dashed border-blue-400/40 flex items-center justify-center z-30 pointer-events-none">
                    <span className="text-blue-300 text-xs font-medium bg-black/60 px-2 py-1 rounded">
                      Drop series here
                    </span>
                  </div>
                )}

                {/* Slice slider */}
                <div className="absolute bottom-10 left-2 right-2 z-20 flex items-center gap-2 bg-black/60 px-2 py-1.5 rounded">
                  <span className="text-white/50 text-[10px] font-mono flex-shrink-0 min-w-8">{state.sliceIndex + 1}</span>
                  <Slider
                    value={[state.sliceIndex]}
                    min={0}
                    max={state.totalSlices - 1}
                    step={1}
                    onValueChange={(val) => {
                      setViewports((prev) => {
                        const next = [...prev];
                        if (linkedViewports) {
                          const ratio = state.totalSlices > 1 ? val[0] / (state.totalSlices - 1) : 0;
                          for (let j = 0; j < next.length; j++) {
                            next[j] = { ...next[j], sliceIndex: Math.round(ratio * (next[j].totalSlices - 1)) };
                          }
                        } else {
                          next[i] = { ...next[i], sliceIndex: val[0] };
                        }
                        return next;
                      });
                    }}
                    className="flex-1"
                  />
                  <span className="text-white/50 text-[10px] font-mono flex-shrink-0 min-w-8">{state.totalSlices}</span>
                </div>
                <ViewportOverlay state={state} index={i} />

                {/* Demo mode watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-white/[0.07] text-2xl font-bold tracking-widest rotate-[-15deg] select-none">
                    DEMO
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#1a1a2e] border-t border-white/10 shrink-0">
        <div className="text-[10px] text-white/40 font-mono">
          {activeTool === 'windowing' ? 'Drag: adjust W/L' : activeTool === 'pan' ? 'Drag: pan' : activeTool === 'zoom' ? 'Scroll: zoom' : 'Click to place'} · Scroll: change slice · Ctrl+Scroll: zoom
        </div>
        <div className="text-[10px] text-white/40 font-mono">
          Demo Mode — Connect Cornerstone3D for real DICOM rendering
        </div>
      </div>
    </div>
  );
}
