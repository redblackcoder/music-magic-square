/**
 * Web Worker for grid scanning pipeline.
 *
 * Pre-loads OpenCV and the ONNX model on startup so that by the time the user
 * taps "capture", the heavy initialization is already done.
 */

import { initOpenCV } from './gridDetection';
import { loadRecognizer, recognizeGrid } from './imageProcessing';
import type { CellRecognizer } from './digitRecognizer';

let _recognizer: CellRecognizer | null = null;

// Pre-init OpenCV and ONNX model immediately on worker start
async function preInit() {
  const t0 = performance.now();
  console.log('[worker] pre-init starting...');

  try {
    // Load both in parallel
    const [, recognizer] = await Promise.all([
      initOpenCV().then(() => console.log('[worker] OpenCV ready')),
      loadRecognizer().then(r => { console.log('[worker] ONNX model ready'); return r; }),
    ]);
    _recognizer = recognizer;

    console.log('[worker] pre-init complete in', Math.round(performance.now() - t0), 'ms');
    self.postMessage({ type: 'ready' });
  } catch (err) {
    console.error('[worker] pre-init failed:', err);
    // Not fatal — will try again on scan
  }
}

preInit();

// Handle scan requests
self.onmessage = async (e: MessageEvent) => {
  const { type, imageData } = e.data;
  if (type !== 'scan') return;

  console.log('[worker] scan request received, image:', imageData.width, '×', imageData.height);
  const t0 = performance.now();

  try {
    const result = await recognizeGrid(
      imageData,
      (pct) => self.postMessage({ type: 'progress', pct }),
      _recognizer ?? undefined,
    );

    console.log('[worker] scan complete in', Math.round(performance.now() - t0), 'ms');

    self.postMessage({
      type: 'result',
      values: result.values,
      gridFound: result.gridFound,
      quadCorners: result.quadCorners,
      warpedImageData: result.warpedImage,
      sourceImageData: result.sourceImage,
    });
  } catch (err) {
    console.error('[worker] scan failed:', err);
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
