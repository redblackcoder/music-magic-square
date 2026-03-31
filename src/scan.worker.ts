/**
 * Web Worker for OpenCV grid detection only.
 *
 * ONNX runtime doesn't work reliably in Web Workers (WASM path resolution
 * and CommonJS require() issues), so cell recognition stays on the main thread.
 * OpenCV is the heavy part (~10MB) that freezes the UI — that's what we offload here.
 */

import { initOpenCV, detectGrid } from './gridDetection';

// Pre-init OpenCV immediately on worker start
async function preInit() {
  const t0 = performance.now();
  console.log('[worker] pre-init: loading OpenCV...');

  try {
    await initOpenCV();
    console.log('[worker] OpenCV ready in', Math.round(performance.now() - t0), 'ms');
    self.postMessage({ type: 'ready' });
  } catch (err) {
    console.error('[worker] OpenCV pre-init failed:', err);
    // Not fatal — detectGrid will try to load it again on scan
  }
}

preInit();

// Handle scan requests — grid detection only
self.onmessage = async (e: MessageEvent) => {
  const { type, imageData } = e.data;
  if (type !== 'scan') return;

  console.log('[worker] grid detection request, image:', imageData.width, '×', imageData.height);
  const t0 = performance.now();

  try {
    const { warped, cells, quadCorners } = await detectGrid(imageData);
    console.log('[worker] grid detection complete in', Math.round(performance.now() - t0), 'ms');

    self.postMessage({
      type: 'gridResult',
      warpedImageData: warped,
      cells,
      quadCorners,
    });
  } catch (err) {
    console.error('[worker] grid detection failed:', err);
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
