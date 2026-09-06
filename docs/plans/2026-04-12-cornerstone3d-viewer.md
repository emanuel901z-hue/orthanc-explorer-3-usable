# Cornerstone3D Embedded Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the procedural canvas rendering in ViewerPage.tsx with Cornerstone3D WebGL rendering that fetches and displays real DICOM pixel data from Orthanc's DICOMweb endpoints.

**Architecture:** The existing UI chrome (SeriesPanel sidebar, toolbar, layout switcher, drag-and-drop UX) stays intact — we're swapping the rendering backend only. Cornerstone3D initializes once per session via a singleton, creates a `RenderingEngine` per viewport, and loads DICOM frames via `wadors:` image IDs pointed at the Orthanc DICOMweb proxy (`/orthanc-proxy/dicom-web`). The existing `useStudy` / `useStudySeries` / `useSeriesInstances` TanStack Query hooks supply real data; we build wadors imageIds from `Instance.sopInstanceUID`.

**Tech Stack:** `@cornerstonejs/core`, `@cornerstonejs/tools`, `@cornerstonejs/dicom-image-loader`, `dicom-parser`, React 18, TanStack Query v5, Vite proxy (already wired), Orthanc DICOMweb plugin (already mounted at `/dicom-web`)

---

## Data Flow

```
URL params (studyId)
  → useStudy()       → Study.studyInstanceUID
  → useStudySeries() → Series[] with seriesInstanceUID, id (Orthanc UUID)
  → SeriesPanel renders real series list (thumbnails via /instances/{id}/preview)
  → User drags a series card to a viewport slot
  → CornerstoneViewport receives { seriesOrthancId, studyInstanceUID, seriesInstanceUID }
  → useSeriesInstances(seriesOrthancId) → Instance[] sorted by instanceNumber
  → buildWadorsImageId(studyUID, seriesUID, inst.sopInstanceUID) per instance
  → Cornerstone3D RenderingEngine.setStack(imageIds) → WebGL render
```

---

## Key File Map

| File | Status | Role |
|------|--------|------|
| `src/features/viewer/pages/ViewerPage.tsx` | Modify | Remove procedural canvas code; wire real data |
| `src/features/viewer/components/SeriesPanel.tsx` | Modify | Add `studyInstanceUID` + `seriesInstanceUID` to `SeriesItem` |
| `src/features/viewer/components/CornerstoneViewport.tsx` | Create | Single WebGL viewport component |
| `src/features/viewer/components/CornerstoneMultiViewport.tsx` | Create | Grid layout managing 1-4 viewports + shared tool group |
| `src/lib/cornerstone.ts` | Create | Init singleton — call once, idempotent |
| `src/lib/cornerstoneImageIds.ts` | Create | `buildWadorsImageId()` builder |
| `src/features/viewer/hooks/useViewerTools.ts` | Create | Toolbar → ToolGroupManager bridge |

---

## Cornerstone3D Package Notes

- `@cornerstonejs/core` — rendering engine, viewport primitives, image loader registry
- `@cornerstonejs/tools` — PanTool, ZoomTool, WindowLevelTool, StackScrollMouseWheelTool, ToolGroupManager
- `@cornerstonejs/dicom-image-loader` — registers `wadors:` and `wadouri:` URL prefixes, calls dicom-parser under the hood
- `dicom-parser` — peer dep of dicom-image-loader; parses raw DICOM bytes

The wadors: URL format Cornerstone3D expects:

```
wadors:/orthanc-proxy/dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/1
```

Vite proxy strips `/orthanc-proxy` prefix, so Orthanc receives:

```
GET /dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/1
```

This is standard DICOMweb WADO-RS — Orthanc DICOMweb plugin responds with `multipart/related`.

---

### Task 1: Install Cornerstone3D packages

**Files:**

- Modify: `package.json` (via npm install)

**Step 1: Install**

```bash
cd /Users/rhavekost/Projects/rhavekost/orthanc-explorer-3
npm install @cornerstonejs/core @cornerstonejs/tools @cornerstonejs/dicom-image-loader dicom-parser
```

**Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: Zero new errors (some pre-existing errors are OK as long as they were there before).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(viewer): install Cornerstone3D packages"
```

---

### Task 2: Create Cornerstone3D initialization singleton

**Files:**

- Create: `src/lib/cornerstone.ts`
- Create: `src/lib/cornerstone.test.ts`

**Step 1: Write the failing test**

Create `src/lib/cornerstone.test.ts`:

```typescript
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
  beforeEach(() => {
    // Reset module-level state between tests by re-importing
    vi.resetModules();
  });

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
```

**Step 2: Run test to verify it FAILS**

```bash
npx vitest run src/lib/cornerstone.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module './cornerstone'`

**Step 3: Write minimal implementation**

Create `src/lib/cornerstone.ts`:

```typescript
import { init as csInit } from '@cornerstonejs/core';
import {
  init as csToolsInit,
  addTool,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollMouseWheelTool,
} from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

let _ready = false;
let _initPromise: Promise<void> | null = null;

export function isCornerstoneReady(): boolean {
  return _ready;
}

/**
 * Initializes Cornerstone3D once per browser session.
 * Safe to call multiple times — subsequent calls return the cached promise.
 */
export async function initCornerstone(): Promise<void> {
  if (_ready) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    await csInit();
    await csToolsInit();

    cornerstoneDICOMImageLoader.init();
    cornerstoneDICOMImageLoader.configure({ useWebWorkers: true });

    // Register tools once — ToolGroupManager references these by name later
    addTool(PanTool);
    addTool(ZoomTool);
    addTool(WindowLevelTool);
    addTool(StackScrollMouseWheelTool);

    _ready = true;
  })();

  return _initPromise;
}
```

**Step 4: Run test to verify it PASSES**

```bash
npx vitest run src/lib/cornerstone.test.ts
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/cornerstone.ts src/lib/cornerstone.test.ts
git commit -m "feat(viewer): Cornerstone3D init singleton with idempotent guard"
```

---

### Task 3: Build wadors image ID helper

**Files:**

- Create: `src/lib/cornerstoneImageIds.ts`
- Create: `src/lib/cornerstoneImageIds.test.ts`

**Step 1: Write the failing test**

Create `src/lib/cornerstoneImageIds.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildWadorsImageId } from './cornerstoneImageIds';

describe('buildWadorsImageId', () => {
  it('builds a wadors: URL with correct DICOMweb path segments', () => {
    const id = buildWadorsImageId({
      studyUID: '1.2.3',
      seriesUID: '1.2.3.4',
      instanceUID: '1.2.3.4.5',
    });
    expect(id).toBe(
      'wadors:/orthanc-proxy/dicom-web/studies/1.2.3/series/1.2.3.4/instances/1.2.3.4.5/frames/1'
    );
  });

  it('defaults frame to 1', () => {
    const id = buildWadorsImageId({
      studyUID: 'A',
      seriesUID: 'B',
      instanceUID: 'C',
    });
    expect(id).toContain('/frames/1');
  });

  it('accepts an explicit frame number', () => {
    const id = buildWadorsImageId({
      studyUID: 'A',
      seriesUID: 'B',
      instanceUID: 'C',
      frame: 3,
    });
    expect(id).toContain('/frames/3');
  });

  it('accepts a custom baseUrl', () => {
    const id = buildWadorsImageId({
      studyUID: 'A',
      seriesUID: 'B',
      instanceUID: 'C',
      baseUrl: 'https://pacs.example.com/wado-rs',
    });
    expect(id).toContain('wadors:https://pacs.example.com/wado-rs');
  });
});
```

**Step 2: Run to verify FAIL**

```bash
npx vitest run src/lib/cornerstoneImageIds.test.ts 2>&1 | tail -10
```

**Step 3: Implement**

Create `src/lib/cornerstoneImageIds.ts`:

```typescript
/** Default base URL — matches the Vite dev proxy config (strips /orthanc-proxy prefix). */
const DEFAULT_BASE_URL = '/orthanc-proxy/dicom-web';

interface WadorsParams {
  studyUID: string;
  seriesUID: string;
  instanceUID: string;
  /** Frame index (1-based). Defaults to 1 for single-frame instances. */
  frame?: number;
  /** Override the DICOMweb root URL. Defaults to the Vite dev proxy path. */
  baseUrl?: string;
}

/**
 * Build a Cornerstone3D wadors: image ID pointing at Orthanc's DICOMweb endpoint.
 *
 * The Vite dev proxy rewrites /orthanc-proxy → http://localhost:8042,
 * so Orthanc receives: GET /dicom-web/studies/.../frames/1
 * which is standard WADO-RS that the Orthanc DICOMweb plugin handles.
 */
export function buildWadorsImageId({
  studyUID,
  seriesUID,
  instanceUID,
  frame = 1,
  baseUrl = DEFAULT_BASE_URL,
}: WadorsParams): string {
  return `wadors:${baseUrl}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}/frames/${frame}`;
}
```

**Step 4: Run to verify PASS**

```bash
npx vitest run src/lib/cornerstoneImageIds.test.ts
```

Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add src/lib/cornerstoneImageIds.ts src/lib/cornerstoneImageIds.test.ts
git commit -m "feat(viewer): buildWadorsImageId helper for Orthanc DICOMweb"
```

---

### Task 4: Update SeriesItem type to carry DICOM UIDs

The `SeriesPanel` currently uses `SeriesItem` with no DICOM UIDs. We need `studyInstanceUID` and `seriesInstanceUID` to build imageIds when a series is dropped onto a viewport.

**Files:**

- Modify: `src/features/viewer/components/SeriesPanel.tsx` (lines 8–14 — the `SeriesItem` interface)

**Step 1: Read the current SeriesItem**

It's at lines 8–14 of `SeriesPanel.tsx`:

```typescript
export interface SeriesItem {
  id: string;
  desc: string;
  modality: string;
  slices: number;
  sequence?: string;
}
```

**Step 2: Extend it**

Change it to:

```typescript
export interface SeriesItem {
  id: string;               // Orthanc series UUID — used as TanStack Query key
  desc: string;
  modality: string;
  slices: number;
  sequence?: string;
  studyInstanceUID: string;  // DICOM StudyInstanceUID — for building wadors: imageIds
  seriesInstanceUID: string; // DICOM SeriesInstanceUID — for building wadors: imageIds
}
```

No other changes in SeriesPanel.tsx are needed.

**Step 3: Fix TypeScript errors**

ViewerPage.tsx constructs `SeriesItem` objects. Check what it currently puts in those fields and add the two new required fields. The real values come from:

```typescript
// In ViewerPage.tsx, when mapping useStudySeries() data:
const study = useStudy(studyId!).data;  // Study.studyInstanceUID
const seriesList = useStudySeries(studyId!).data; // Series[].seriesInstanceUID

const seriesItems: SeriesItem[] = (seriesList ?? []).map(s => ({
  id: s.id,
  desc: s.seriesDescription ?? s.modality,
  modality: s.modality,
  slices: s.numberOfInstances,
  studyInstanceUID: study?.studyInstanceUID ?? '',
  seriesInstanceUID: s.seriesInstanceUID,
}));
```

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: No errors referencing `SeriesItem`.

**Step 5: Commit**

```bash
git add src/features/viewer/components/SeriesPanel.tsx src/features/viewer/pages/ViewerPage.tsx
git commit -m "feat(viewer): add studyInstanceUID/seriesInstanceUID to SeriesItem"
```

---

### Task 5: Create CornerstoneViewport — single WebGL viewport

This component owns one `RenderingEngine`, loads a series as a Stack, and joins the shared tool group.

It internally calls `useSeriesInstances` (existing hook) and `buildWadorsImageId` to get imageIds without any new networking code.

**Files:**

- Create: `src/features/viewer/components/CornerstoneViewport.tsx`

> **No unit test for this component** — Cornerstone3D calls WebGL APIs that jsdom cannot simulate. Browser integration testing in Task 9.

Create `src/features/viewer/components/CornerstoneViewport.tsx`:

```typescript
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
      const tg = ToolGroupManager.getToolGroup(toolGroupId);
      tg?.removeViewports(engineRef.current?.id);
      engineRef.current?.destroy();
      engineRef.current = null;
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
  }, [imageIds.join(','), engineReady]); // join to get stable primitive dep

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
```

**Step: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

**Step: Commit**

```bash
git add src/features/viewer/components/CornerstoneViewport.tsx
git commit -m "feat(viewer): CornerstoneViewport with WebGL stack rendering and wadors: image loading"
```

---

### Task 6: Create CornerstoneMultiViewport — grid layout

Manages 1–4 `CornerstoneViewport` instances in a CSS grid, creates/owns the shared ToolGroup, handles drag-and-drop into slots.

**Files:**

- Create: `src/features/viewer/components/CornerstoneMultiViewport.tsx`

Create `src/features/viewer/components/CornerstoneMultiViewport.tsx`:

```typescript
import { useEffect, useState } from 'react';
import {
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollMouseWheelTool,
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
  /** Indexed 0-3. Null means the slot is empty. */
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

  // Create tool group once on mount
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
        tg.addTool(StackScrollMouseWheelTool.toolName);

        // Default: left-click = window/level, middle = pan, right = zoom, wheel = scroll
        tg.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        });
        tg.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Auxiliary }],
        });
        tg.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Secondary }],
        });
        tg.setToolActive(StackScrollMouseWheelTool.toolName, { bindings: [] });
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
      // malformed drag data — ignore
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
```

**Step: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

**Step: Commit**

```bash
git add src/features/viewer/components/CornerstoneMultiViewport.tsx
git commit -m "feat(viewer): CornerstoneMultiViewport with drag-and-drop series loading"
```

---

### Task 7: Create useViewerTools hook

Provides a `setActiveTool` function that swaps the primary mouse binding in the shared ToolGroup — called by the toolbar buttons.

**Files:**

- Create: `src/features/viewer/hooks/useViewerTools.ts`
- Create: `src/features/viewer/hooks/useViewerTools.test.ts`

**Step 1: Write the failing test**

Create `src/features/viewer/hooks/useViewerTools.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTg = {
  setToolPassive: vi.fn(),
  setToolActive: vi.fn(),
};

vi.mock('@cornerstonejs/tools', () => ({
  ToolGroupManager: { getToolGroup: vi.fn().mockReturnValue(mockTg) },
  PanTool: { toolName: 'Pan' },
  ZoomTool: { toolName: 'Zoom' },
  WindowLevelTool: { toolName: 'WindowLevel' },
  Enums: { MouseBindings: { Primary: 1 } },
}));

import { renderHook, act } from '@testing-library/react';
import { useViewerTools } from './useViewerTools';

describe('useViewerTools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('setActiveTool(pan) deactivates others and activates PanTool', () => {
    const { result } = renderHook(() => useViewerTools());
    act(() => result.current.setActiveTool('pan'));

    expect(mockTg.setToolPassive).toHaveBeenCalledWith('WindowLevel');
    expect(mockTg.setToolPassive).toHaveBeenCalledWith('Zoom');
    expect(mockTg.setToolActive).toHaveBeenCalledWith('Pan', expect.any(Object));
  });

  it('setActiveTool(windowing) activates WindowLevelTool', () => {
    const { result } = renderHook(() => useViewerTools());
    act(() => result.current.setActiveTool('windowing'));

    expect(mockTg.setToolActive).toHaveBeenCalledWith('WindowLevel', expect.any(Object));
  });
});
```

**Step 2: Run to verify FAIL**

```bash
npx vitest run src/features/viewer/hooks/useViewerTools.test.ts 2>&1 | tail -10
```

**Step 3: Implement**

Create `src/features/viewer/hooks/useViewerTools.ts`:

```typescript
import { ToolGroupManager, PanTool, ZoomTool, WindowLevelTool, Enums as ToolEnums } from '@cornerstonejs/tools';
import { VIEWER_TOOL_GROUP_ID } from '@/features/viewer/components/CornerstoneMultiViewport';

const { MouseBindings } = ToolEnums;

export type ViewerTool = 'pan' | 'zoom' | 'windowing';

export function useViewerTools() {
  const setActiveTool = (tool: ViewerTool) => {
    const tg = ToolGroupManager.getToolGroup(VIEWER_TOOL_GROUP_ID);
    if (!tg) return;

    // Deactivate all primary-button tools first
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
```

**Step 4: Run to verify PASS**

```bash
npx vitest run src/features/viewer/hooks/useViewerTools.test.ts
```

**Step 5: Commit**

```bash
git add src/features/viewer/hooks/
git commit -m "feat(viewer): useViewerTools hook for toolbar tool switching"
```

---

### Task 8: Rewrite ViewerPage.tsx

Replace all procedural canvas code with the real Cornerstone3D components. Keep the header bar, toolbar, layout switcher, and SeriesPanel wrappers.

**Files:**

- Modify: `src/features/viewer/pages/ViewerPage.tsx`

**Step 1: Read the current end of ViewerPage.tsx**

Before editing, understand the full structure by reading from line 250 to the end. This shows how the canvas grid and toolbar are currently rendered.

```bash
# Count lines first
wc -l src/features/viewer/pages/ViewerPage.tsx
```

Then read: `Read src/features/viewer/pages/ViewerPage.tsx` with appropriate offset.

**Step 2: Identify what to keep vs delete**

**KEEP:**

- Imports: `useParams`, `useNavigate`, `Button`, `Separator`, `Badge`, shadcn UI components, lucide icons
- `useStudy`, `useStudySeries` hooks
- `formatPatientName`
- `SeriesPanel` import
- The full header bar (patient info, close button)
- The toolbar (tool buttons + layout switcher)
- The `Layout` type

**DELETE (replace with Cornerstone3D):**

- `generateMRISlice()` function (~100 lines of procedural math)
- `generateDemoSlice()` function (~100 lines of procedural math)
- `DEFAULT_WL` constant
- All `DEMO_SERIES` / `DEMO_STUDY` mock data
- All `useRef<HTMLCanvasElement>` / `useEffect` canvas drawing code
- `ViewportState` interface (we use a simpler slot-series map)
- The canvas grid JSX

**Step 3: Write the new ViewerPage.tsx**

The new file structure (imports + component body):

```typescript
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { X, RotateCcw, Grid2X2, Maximize2, ZoomIn, ZoomOut, Contrast, LayoutGrid } from 'lucide-react';
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

  // Slot series assignment: 4 slots max, null = empty
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

  const handleResetActive = () => {
    // Reset zoom/pan for active viewport — Cornerstone3D camera reset
    // CornerstoneViewport can expose a reset ref if needed; for now no-op placeholder
  };

  const patientLabel = study
    ? `${formatPatientName(study.patientName)} · ${study.studyDescription ?? study.modalities.join('/')}`
    : 'Loading…';

  return (
    <div className="flex flex-col h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* ── Header bar ──────────────────────────────────────────── */}
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

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-1 bg-[#0e0e22] border-b border-white/10 shrink-0">
        {/* Tool buttons */}
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
          <TooltipContent side="bottom" className="text-xs">Window / Level (left-drag)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'pan' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white"
              onClick={() => handleToolChange('pan')}
            >
              {/* Move icon */}
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
                <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
                <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Pan (middle-drag)</TooltipContent>
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
          <TooltipContent side="bottom" className="text-xs">Zoom (right-drag)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white"
              onClick={handleResetActive}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Reset view</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 bg-white/20 mx-1" />

        {/* Layout buttons */}
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

      {/* ── Body: Series panel + viewport grid ──────────────────── */}
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
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Fix any type errors before committing.

**Step 5: Run all tests**

```bash
npm run test
```

Expected: All existing tests pass. New test files also pass.

**Step 6: Commit**

```bash
git add src/features/viewer/pages/ViewerPage.tsx
git commit -m "feat(viewer): replace procedural canvas with Cornerstone3D in ViewerPage"
```

---

### Task 9: Verify Vite proxy covers DICOMweb path

**Files:**

- Read: `vite.config.ts` (already confirmed — no changes needed)

The existing proxy:

```typescript
"/orthanc-proxy": {
  target: "http://localhost:8042",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/orthanc-proxy/, ""),
},
```

A Cornerstone3D request to:

```
/orthanc-proxy/dicom-web/studies/1.2.3.../frames/1
```

becomes:

```
http://localhost:8042/dicom-web/studies/1.2.3.../frames/1
```

This is correct. No `vite.config.ts` changes needed.

**Verify DICOMweb plugin is running:**

```bash
curl -s http://localhost:8042/dicom-web/studies | head -5
```

Expected: `[]` or a JSON array. If you get a 404, the DICOMweb plugin may not be enabled — check `docker-compose.dev.yml` for plugin config and refer to the Orthanc DICOMweb plugin docs.

---

### Task 10: Browser integration verification checklist

With `npm run dev` running and `docker compose -f docker-compose.dev.yml up -d` running:

```
[ ] Navigate to StudyListPage and click through to a study
[ ] Click "Open Viewer" (or the viewer button on the study detail page)
[ ] ViewerPage loads — no red console errors
[ ] SeriesPanel shows real series names and modalities from Orthanc (not "BRAIN MRI T1" etc.)
[ ] Drag a series card into the viewport → spinner appears → images load
[ ] Mouse wheel scrolls through slices (StackScrollMouseWheelTool)
[ ] Left-click + drag changes window/level (image brightness/contrast changes)
[ ] Middle-click + drag pans the image
[ ] Right-click + drag zooms
[ ] Click "Pan" toolbar button → left-click + drag now pans
[ ] Click "W/L" toolbar button → left-click + drag restores window/level
[ ] Click "2×2" layout → 4 viewports appear; drag different series into each
[ ] Click "1×2" layout → 2 viewports stacked vertically
[ ] Active viewport gets blue outline on click
[ ] Closing viewer (X button) navigates back
[ ] No PHI logged to console (check DevTools — image URLs are fine but no patient names)
```

---

## Notes for the Implementer

### Cornerstone3D WebWorkers in Vite

Cornerstone3D's DICOM image loader uses a Web Worker for DICOM parsing. Vite serves worker files correctly in dev mode. If you see "Failed to fetch worker", add this to `vite.config.ts`:

```typescript
optimizeDeps: {
  exclude: ['@cornerstonejs/dicom-image-loader'],
},
```

### `imageIds.join(',')` as useEffect dep

Using `imageIds.join(',')` instead of `imageIds` (array reference) as a useEffect dependency gives a stable primitive comparison — no infinite re-render loops. This is intentional.

### Empty slots

Empty viewport slots (null `seriesInfo`) show a "Drag a series here" placeholder. This is intentional — match the OHIF design pattern from the ResonAit `MultiSeriesViewer` reference.

### Real window/level values

Cornerstone3D will read `(0028,1050)` WindowCenter and `(0028,1051)` WindowWidth from the DICOM header and apply them automatically when loading each instance. No manual W/L initialization needed for CT/MR studies that embed these tags.

### Thumbnail images in SeriesPanel

The SeriesPanel currently renders procedural canvas thumbnails. A future task can replace these with real `<img src="/orthanc-proxy/instances/{firstInstanceId}/preview" />` tags now that `firstInstanceId` is available from the `Series` type. Do not do this in this plan — it is out of scope.
