import { createDigitRecognizer, prepareDigitInput, type DigitRecognizer } from './digitRecognizer';
import type { CellValue, NoteDuration } from './types';

/**
 * ONNX-based digit recognition for hand-drawn 4x4 grids.
 *
 * Each cell contains a number (1, 2, 4, 8) or a tied pair (e.g. "1+2").
 * Numbers represent sixteenths: 1→1/16, 2→1/8, 4→1/4, 8→1/2.
 *
 * Uses the official MNIST ONNX model (26 KB) for digit classification.
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
 * Recognize a single cell image using the MNIST model.
 * The image should contain a single hand-drawn digit.
 */
export async function recognizeCellFromImageData(
  recognizer: DigitRecognizer,
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

  const { digit, confidence } = await recognizer.recognize(pixels);

  if (confidence < 0.5) return DEFAULT_CELL;

  return digitToCellValue(digit) ?? DEFAULT_CELL;
}

/**
 * Recognize a 4x4 grid of hand-drawn numbers using ONNX MNIST model.
 */
export async function recognizeGrid(
  imageData: ImageData,
  onProgress?: (pct: number) => void,
): Promise<CellValue[][]> {
  const bounds = detectGridBounds(imageData);
  const cellW = bounds.w / 4;
  const cellH = bounds.h / 4;

  // In browser, model is served from public/
  const modelPath = new URL('/mnist-12.onnx', window.location.origin).href;
  const recognizer = await createDigitRecognizer(modelPath);

  const result: CellValue[][] = [];

  try {
    for (let r = 0; r < 4; r++) {
      const row: CellValue[] = [];
      for (let c = 0; c < 4; c++) {
        const cell = await recognizeCellFromImageData(
          recognizer,
          imageData,
          bounds.x + c * cellW,
          bounds.y + r * cellH,
          cellW,
          cellH,
        );
        row.push(cell);
        onProgress?.((r * 4 + c + 1) / 16);
      }
      result.push(row);
    }
  } finally {
    await recognizer.dispose();
  }

  return result;
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
