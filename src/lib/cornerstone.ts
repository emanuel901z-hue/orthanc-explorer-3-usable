import { init as csInit } from '@cornerstonejs/core';
import {
  init as csToolsInit,
  addTool,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
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

    // init() registers the wado-rs / wado-uri loaders and spins up
    // the decode web worker (via new URL('./decodeImageFrameWorker.js', import.meta.url)).
    // Vite bundles the worker as ES format (worker.format: 'es' in vite.config.ts).
    cornerstoneDICOMImageLoader.init();

    addTool(PanTool);
    addTool(ZoomTool);
    addTool(WindowLevelTool);
    addTool(StackScrollTool);

    _ready = true;
  })().catch((err) => {
    _initPromise = null; // allow retry
    throw err;
  });

  return _initPromise;
}
