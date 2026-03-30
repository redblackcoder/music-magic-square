import Tesseract from 'tesseract.js';
import type { CellValue, NoteDuration } from './types';

/**
 * OCR-based number recognition for hand-drawn 4x4 grids.
 *
 * Each cell contains a number (1, 2, 4, 8) or a tied pair (e.g. "1+2").
 * Numbers represent sixteenths: 1→1/16, 2→1/8, 4→1/4, 8→1/2.
 *
 * Uses Tesseract.js with character whitelist "12348+" for maximum accuracy.
 */

/** Map a sixteenths numerator to a NoteDuration */
const NUM_TO_DUR: Record<number, NoteDuration> = {
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

/** Parse a recognized string into a CellValue, or null if unrecognizable */
function parseCellText(text: string): CellValue | null {
  // Clean up OCR artifacts
  const clean = text.replace(/\s/g, '').replace(/[oO]/g, '0');

  // Try single number
  const singleMatch = clean.match(/^(\d+)$/);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    if (VALID_SINGLES.has(n) && NUM_TO_DUR[n]) {
      return { kind: 'single', dur: NUM_TO_DUR[n] };
    }
  }

  // Try tied pair: "N+M" in any order
  const pairMatch = clean.match(/^(\d+)\+(\d+)$/);
  if (pairMatch) {
    let a = parseInt(pairMatch[1], 10);
    let b = parseInt(pairMatch[2], 10);
    // Normalize order: smaller first
    if (a > b) [a, b] = [b, a];
    if (VALID_PAIRS.some(([x, y]) => x === a && y === b) && NUM_TO_DUR[a] && NUM_TO_DUR[b]) {
      return { kind: 'tied', first: NUM_TO_DUR[a], second: NUM_TO_DUR[b] };
    }
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

/** Extract a sub-region of an ImageData as a new canvas for Tesseract */
function extractCellCanvas(
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Create a temporary canvas with the full image
  const tmp = document.createElement('canvas');
  tmp.width = imageData.width;
  tmp.height = imageData.height;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.putImageData(imageData, 0, 0);

  // Draw the cropped region with padding
  const pad = Math.round(Math.min(w, h) * 0.05);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(tmp, x + pad, y + pad, w - 2 * pad, h - 2 * pad, 0, 0, w, h);

  return canvas;
}

/** Detect the grid bounding box from the image (find the drawn grid area) */
function detectGridBounds(imageData: ImageData): { x: number; y: number; w: number; h: number } {
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
 * Recognize a 4x4 grid of hand-drawn numbers using Tesseract OCR.
 * Returns a 4x4 array of CellValues.
 * Falls back to quarter note for any unrecognizable cell.
 */
export async function recognizeGrid(
  imageData: ImageData,
  onProgress?: (pct: number) => void,
): Promise<CellValue[][]> {
  const bounds = detectGridBounds(imageData);
  const cellW = Math.floor(bounds.w / 4);
  const cellH = Math.floor(bounds.h / 4);

  // Extract all 16 cell images
  const cellCanvases: { r: number; c: number; canvas: HTMLCanvasElement }[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const canvas = extractCellCanvas(
        imageData,
        Math.floor(bounds.x + c * cellW),
        Math.floor(bounds.y + r * cellH),
        cellW,
        cellH,
      );
      cellCanvases.push({ r, c, canvas });
    }
  }

  // Create a Tesseract worker with character whitelist
  const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    },
  });
  await worker.setParameters({
    tessedit_char_whitelist: '12348+',
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
  });

  // OCR each cell
  const result: CellValue[][] = Array.from({ length: 4 }, () => Array(4).fill(null));
  const defaultValue: CellValue = { kind: 'single', dur: '1/4' };

  for (const { r, c, canvas } of cellCanvases) {
    try {
      const { data } = await worker.recognize(canvas);
      const parsed = parseCellText(data.text.trim());
      result[r][c] = parsed ?? defaultValue;
    } catch {
      result[r][c] = defaultValue;
    }
  }

  await worker.terminate();

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

  ctx.strokeStyle = 'rgba(233, 69, 96, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);

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

  // Draw example numbers in each cell for guidance
  ctx.font = `${cellSize * 0.3}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const examples = ['8', '4', '1', '2+1', '1', '2+1', '8', '4', '2+1', '1', '4', '8', '4', '8', '2+1', '1'];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillText(examples[r * 4 + c], gx + c * cellSize + cellSize / 2, gy + r * cellSize + cellSize / 2);
    }
  }
}
