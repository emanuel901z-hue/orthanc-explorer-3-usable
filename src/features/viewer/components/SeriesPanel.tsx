import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

export interface SeriesItem {
  id: string;
  desc: string;
  modality: string;
  slices: number;
  sequence?: string;
  studyInstanceUID: string; // DICOM StudyInstanceUID — for building wadors: imageIds
  seriesInstanceUID: string; // DICOM SeriesInstanceUID — for building wadors: imageIds
}

function renderThumbnail(canvas: HTMLCanvasElement, item: SeriesItem) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const r = Math.min(w, h) * 0.4;
  const cx = w / 2;
  const cy = h / 2;
  const mid = Math.floor(item.slices * 0.45);
  const depth = Math.sin((mid / item.slices) * Math.PI);
  const isMR = item.modality === 'MR';
  const isT1 = item.sequence?.includes('T1') ?? false;

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * w + x) * 4;

      if (dist > r * depth + r * 0.15) {
        data[idx + 3] = 255;
        continue;
      }

      let v = 0;
      if (isMR) {
        const outerR = r * depth + r * 0.15;
        const skull = outerR - r * 0.06;
        if (dist > skull) {
          v = isT1 ? 60 : 35;
        } else if (dist > skull - r * 0.08) {
          v = isT1 ? 140 : 180;
        } else {
          v = isT1 ? 190 : 120;
          // ventricles
          const ventY = cy - r * 0.02;
          for (const s of [-1, 1]) {
            const vdx = (x - (cx + s * r * 0.12 * depth)) / (r * 0.07);
            const vdy = (y - ventY) / (r * 0.09 * depth);
            if (vdx * vdx + vdy * vdy < 1) v = isT1 ? 30 : 230;
          }
        }
      } else {
        // CT body
        const outerR = r * depth + r * 0.15;
        if (dist > outerR * 0.92) {
          v = 45;
        } else {
          v = 80;
          // lungs
          for (const s of [-1, 1]) {
            const ldx = (x - (cx + s * r * 0.28)) / (r * 0.2 * depth + r * 0.05);
            const ldy = (y - (cy - r * 0.05)) / (r * 0.28 * depth + r * 0.05);
            if (ldx * ldx + ldy * ldy < 1) v = 15;
          }
          // spine
          const sd = Math.sqrt((x - cx) ** 2 + (y - (cy + r * 0.25)) ** 2);
          if (sd < r * 0.1) v = 220;
        }
      }

      data[idx] = data[idx + 1] = data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function SeriesThumbnail({ item }: { item: SeriesItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) renderThumbnail(canvasRef.current, item);
  }, [item]);

  return (
    <canvas
      ref={canvasRef}
      width={48}
      height={48}
      className="rounded shrink-0 bg-black"
      style={{ width: 48, height: 48 }}
    />
  );
}

interface SeriesPanelProps {
  seriesList: SeriesItem[];
  collapsed: boolean;
  onToggle: () => void;
}

export function SeriesPanel({ seriesList, collapsed, onToggle }: SeriesPanelProps) {
  const handleDragStart = (e: React.DragEvent, seriesItem: SeriesItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(seriesItem));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className={cn(
        'shrink-0 bg-[#12122a] border-r border-white/10 flex flex-col transition-all duration-200',
        collapsed ? 'w-10' : 'w-56',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center border-b border-white/10 shrink-0',
          collapsed ? 'justify-center py-2' : 'justify-between px-3 py-2',
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
            <Layers className="h-3.5 w-3.5" />
            Series
            <Badge
              variant="outline"
              className="text-[9px] text-white/40 border-white/20 px-1 py-0 ml-1"
            >
              {seriesList.length}
            </Badge>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-white/40 hover:text-white hover:bg-white/10"
              onClick={onToggle}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {collapsed ? 'Show series' : 'Hide series'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Series list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
          <div className="px-2 py-1 text-[9px] text-white/30 uppercase tracking-wider font-medium">
            Drag to viewport
          </div>
          {seriesList.map((s) => (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => handleDragStart(e, s)}
              className="mx-1 px-2 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-white/8 border border-transparent hover:border-white/10 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <SeriesThumbnail item={s} />
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-[11px] font-medium leading-tight truncate">
                    {s.desc}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1 py-0 border-white/20',
                        s.modality === 'MR' ? 'text-blue-400' : 'text-amber-400',
                      )}
                    >
                      {s.modality}
                    </Badge>
                    <span className="text-white/30 text-[9px]">{s.slices} sl.</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed state: rotated label */}
      {collapsed && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-white/30 text-[10px] font-medium [writing-mode:vertical-lr] rotate-180 tracking-wider">
            SERIES
          </span>
        </div>
      )}
    </div>
  );
}
