import { createCellRecognizer, prepareDigitInput, type CellRecognizer } from './digitRecognizer';
import { detectGrid } from './gridDetection';
import type { CellValue, NoteDuration } from './types';

/** Confidence metadata for a single recognized cell */
export interface CellConfidence {
  /** 0.0–1.0 confidence score */
  confidence: number;
  /** Which recognition pass produced this result */
  source: 'mnist' | 'mfr' | 'default';
}

/** Result of scanning a grid image, including diagnostics for preview */
export interface ScanResult {
  /** Recognized cell values (4×4) */
  values: CellValue[][];
  /** Per-cell confidence from the recognition pipeline (4×4) */
  confidences: CellConfidence[][];
  /** The captured source image */
  sourceImage: ImageData;
  /** Whether a quadrilateral grid outline was found (vs fallback bounding box) */
  gridFound: boolean;
  /** The 4 corners of the detected quad in source image coords [tl, tr, br, bl] */
  quadCorners: [number, number][];
  /** The perspective-corrected grid image */
  warpedImage: ImageData;
}

/**
 * ONNX-based recognition for hand-drawn 4x4 grids.
 *
 * Supports two models:
 * - cell-recognizer.onnx (65 classes): digits + sums like "2+4"
 * - mnist-12.onnx (10 classes): single digits only (fallback)
 *
 * Each cell contains a number (1, 2, 4, 8) or a tied pair (e.g. "1+2").
 * Numbers represent sixteenths: 1→1/16, 2→1/8, 4→1/4, 8→1/2.
 */

/** Map a sixteenths numerator to a NoteDuration */
export const NUM_TO_DUR: Record<number, NoteDuration> = {
  1: '1/16',
  2: '1/8',
  4: '1/4',
  8: '1/2',
};

/** All valid single values */
const VALID_SINGLES = new Set([1, 2, 4, 8]);

/** All valid tied pairs (sorted smaller first) */
const VALID_PAIRS: [number, number][] = [
  [1, 2], [1, 4], [1, 8],
  [2, 4], [2, 8],
  [4, 8],
];

/** Default fallback when recognition fails */
export const DEFAULT_CELL: CellValue = { kind: 'single', dur: '1/4' };

/** Parse a recognized string into a CellValue, or null if unrecognizable */
export function parseCellText(text: string): CellValue | null {
  const clean = text.replace(/\s/g, '').replace(/[oO]/g, '0');

  const singleMatch = clean.match(/^(\d+)$/);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    if (VALID_SINGLES.has(n) && NUM_TO_DUR[n]) {
      return { kind: 'single', dur: NUM_TO_DUR[n] };
    }
  }

  const pairMatch = clean.match(/^(\d+)\+(\d+)$/);
  if (pairMatch) {
    let a = parseInt(pairMatch[1], 10);
    let b = parseInt(pairMatch[2], 10);
    if (a > b) [a, b] = [b, a];
    if (VALID_PAIRS.some(([x, y]) => x === a && y === b) && NUM_TO_DUR[a] && NUM_TO_DUR[b]) {
      return { kind: 'tied', first: NUM_TO_DUR[a], second: NUM_TO_DUR[b] };
    }
  }

  return null;
}

/** Convert a digit (0-9) from MNIST to a CellValue, or null if not a valid note digit */
export function digitToCellValue(digit: number): CellValue | null {
  if (VALID_SINGLES.has(digit) && NUM_TO_DUR[digit]) {
    return { kind: 'single', dur: NUM_TO_DUR[digit] };
  }
  return null;
}

/**
 * Convert a class label (e.g., "4", "2+8") to a CellValue.
 * Handles both single digits and sum expressions.
 * For sums, normalizes order (smaller first) and validates the pair.
 */
export function labelToCellValue(label: string): CellValue | null {
  return parseCellText(label);
}

/** Get image data from a video element */
export function captureFrame(video: HTMLVideoElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Detect the grid bounding box from the image */
export function detectGridBounds(imageData: ImageData): { x: number; y: number; w: number; h: number } {
  const { width: w, height: h, data } = imageData;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let darkCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (gray < 128) {
        darkCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (darkCount < 100) {
    const size = Math.min(w, h) * 0.8;
    return { x: (w - size) / 2, y: (h - size) / 2, w: size, h: size };
  }

  const pad = 5;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX + pad) - Math.max(0, minX - pad),
    h: Math.min(h, maxY + pad) - Math.max(0, minY - pad),
  };
}

/**
 * Recognize a single cell image using a CellRecognizer.
 * Works with both the 65-class model and the 10-class MNIST wrapper.
 */
export async function recognizeCellFromImageData(
  recognizer: CellRecognizer,
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<CellValue> {
  // 10% inset to avoid grid lines
  const inset = 0.1;
  const cx = Math.floor(x + w * inset);
  const cy = Math.floor(y + h * inset);
  const cw = Math.floor(w * (1 - 2 * inset));
  const ch = Math.floor(h * (1 - 2 * inset));

  const pixels = prepareDigitInput(
    (px, py) => {
      const sx = cx + px;
      const sy = cy + py;
      if (sx < 0 || sx >= imageData.width || sy < 0 || sy >= imageData.height) return 255;
      const i = (sy * imageData.width + sx) * 4;
      return 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
    },
    cw,
    ch,
  );

  const { label, confidence } = await recognizer.recognize(pixels);

  if (confidence < 0.5) {
    console.log(`[ocr] low confidence: label="${label}" conf=${confidence.toFixed(3)} → using default`);
    return DEFAULT_CELL;
  }
  const parsed = labelToCellValue(label);
  if (!parsed) {
    console.log(`[ocr] invalid label: "${label}" conf=${confidence.toFixed(3)} → using default`);
  } else {
    console.log(`[ocr] recognized: "${label}" conf=${confidence.toFixed(3)}`);
  }
  return parsed ?? DEFAULT_CELL;
}

/**
 * Load the ONNX cell recognizer. Tries 65-class model first, falls back to MNIST.
 * Uses `location.origin` which works in both main thread and Web Workers.
 */
export async function loadRecognizer(): Promise<CellRecognizer> {
  const origin = typeof globalThis.location !== 'undefined' ? location.origin : '';
  console.log('[scan] loading ONNX model...');
  const t0 = performance.now();
  try {
    const modelPath = new URL('/cell-recognizer.onnx', origin).href;
    console.log('[scan] trying 65-class model:', modelPath);
    const r = await createCellRecognizer(modelPath);
    console.log('[scan] 65-class model loaded in', Math.round(performance.now() - t0), 'ms');
    return r;
  } catch (e) {
    console.warn('[scan] 65-class model failed, falling back to MNIST:', e);
    const modelPath = new URL('/mnist-12.onnx', origin).href;
    console.log('[scan] loading MNIST model:', modelPath);
    const r = await createCellRecognizer(modelPath, ['0','1','2','3','4','5','6','7','8','9']);
    console.log('[scan] MNIST model loaded in', Math.round(performance.now() - t0), 'ms');
    return r;
  }
}

/**
 * Recognize a 4x4 grid of hand-drawn numbers/sums.
 * Uses OpenCV for grid detection (edge detection + perspective transform),
 * then ONNX model for cell content recognition.
 *
 * Returns a ScanResult with diagnostic info for preview/confirmation.
 * Pass a pre-loaded recognizer to skip model loading (used by the Web Worker).
 */
export async function recognizeGrid(
  imageData: ImageData,
  onProgress?: (pct: number) => void,
  preloadedRecognizer?: CellRecognizer,
): Promise<ScanResult> {
  const t0 = performance.now();
  console.log('[scan] recognizeGrid called, image:', imageData.width, '×', imageData.height);

  // Detect grid with OpenCV (perspective-corrected)
  console.log('[scan] step 1: detecting grid with OpenCV...');
  const { warped, cells, quadCorners } = await detectGrid(imageData);
  console.log('[scan] grid detection done in', Math.round(performance.now() - t0), 'ms');
  console.log('[scan] warped image:', warped.width, '×', warped.height, ', cells:', cells.length);
  console.log('[scan] quadCorners:', JSON.stringify(quadCorners));

  // Check if a real quad was found (corners form a non-trivial quadrilateral)
  // The fallback produces an axis-aligned rectangle from bounding box
  const [tl, tr, br, bl] = quadCorners;
  const isAxisAligned =
    Math.abs(tl[1] - tr[1]) < 2 &&
    Math.abs(bl[1] - br[1]) < 2 &&
    Math.abs(tl[0] - bl[0]) < 2 &&
    Math.abs(tr[0] - br[0]) < 2;
  const gridFound = !isAxisAligned;
  console.log('[scan] gridFound:', gridFound, '(isAxisAligned:', isAxisAligned, ')');

  // Use pre-loaded recognizer or load one now
  const ownRecognizer = !preloadedRecognizer;
  const recognizer = preloadedRecognizer ?? await loadRecognizer();

  const values: CellValue[][] = [[], [], [], []];

  try {
    console.log('[scan] step 2: recognizing 16 cells...');
    for (let i = 0; i < cells.length; i++) {
      const { x, y, w, h, row, col } = cells[i];
      const cell = await recognizeCellFromImageData(recognizer, warped, x, y, w, h);
      const label = (cell.kind === 'tied' || cell.kind === 'restPair') ? `${cell.first}+${cell.second}` : cell.dur;
      console.log(`[scan] cell[${row},${col}] (${x},${y} ${w}×${h}) → ${label}`);
      values[row].push(cell);
      onProgress?.((i + 1) / 16);
    }
  } finally {
    if (ownRecognizer) await recognizer.dispose();
  }

  const elapsed = Math.round(performance.now() - t0);
  console.log('[scan] recognizeGrid complete in', elapsed, 'ms');
  console.log('[scan] result grid:');
  for (let r = 0; r < 4; r++) {
    const row = values[r].map(v => {
      if (v.kind === 'tied' || v.kind === 'restPair') return `${v.first}+${v.second}`;
      return v.dur;
    });
    console.log(`[scan]   row ${r}: [${row.join(', ')}]`);
  }

  return {
    values,
    confidences: values.map(row => row.map(() => ({ confidence: 1.0, source: 'mnist' as const }))),
    sourceImage: imageData,
    gridFound,
    quadCorners,
    warpedImage: warped,
  };
}

/** Draw detection overlay on a canvas for visual feedback */
export function drawDetectionOverlay(
  ctx: CanvasRenderingContext2D,
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
) {
  const scale = Math.min(canvasW / videoW, canvasH / videoH);
  const gridSize = Math.min(videoW, videoH) * 0.7 * scale;
  const gx = (canvasW - gridSize) / 2;
  const gy = (canvasH - gridSize) / 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvasW, gy);
  ctx.fillRect(0, gy + gridSize, canvasW, canvasH - gy - gridSize);
  ctx.fillRect(0, gy, gx, gridSize);
  ctx.fillRect(gx + gridSize, gy, canvasW - gx - gridSize, gridSize);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(gx, gy, gridSize, gridSize);

  const cellSize = gridSize / 4;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(gx + i * cellSize, gy);
    ctx.lineTo(gx + i * cellSize, gy + gridSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gx, gy + i * cellSize);
    ctx.lineTo(gx + gridSize, gy + i * cellSize);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  ctx.font = `bold ${cellSize * 0.3}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const examples = ['8', '4', '1', '2+1', '1', '2+1', '8', '4', '2+1', '1', '4', '8', '4', '8', '2+1', '1'];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillText(examples[r * 4 + c], gx + c * cellSize + cellSize / 2, gy + r * cellSize + cellSize / 2);
    }
  }
}
