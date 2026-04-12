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

    addTool(PanTool);
    addTool(ZoomTool);
    addTool(WindowLevelTool);
    addTool(StackScrollMouseWheelTool);

    _ready = true;
  })();

  return _initPromise;
}
