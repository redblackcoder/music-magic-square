import { type NoteDuration } from './types';

/**
 * Lightweight image-based note recognition.
 * Analyzes each cell region of a captured grid image to classify the hand-drawn note type.
 *
 * Strategy:
 * 1. Convert captured image to grayscale
 * 2. Use adaptive thresholding to detect drawn marks
 * 3. Detect the grid lines (find the largest rectangle, divide into 4x4)
 * 4. For each cell, analyze the ink pattern to classify the note type
 */

interface Rect { x: number; y: number; w: number; h: number; }

/** Get image data from a video element or canvas */
export function captureFrame(video: HTMLVideoElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Convert ImageData to grayscale values */
function toGrayscale(img: ImageData): Uint8Array {
  const gray = new Uint8Array(img.width * img.height);
  for (let i = 0; i < gray.length; i++) {
    const r = img.data[i * 4];
    const g = img.data[i * 4 + 1];
    const b = img.data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/** Simple adaptive threshold */
function adaptiveThreshold(gray: Uint8Array, w: number, h: number, blockSize: number = 15): Uint8Array {
  const binary = new Uint8Array(w * h);
  const half = Math.floor(blockSize / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            sum += gray[ny * w + nx];
            count++;
          }
        }
      }
      const mean = sum / count;
      binary[y * w + x] = gray[y * w + x] < mean - 10 ? 0 : 255;
    }
  }
  return binary;
}

/** Try to detect a 4x4 grid from the binary image.
 *  Returns the bounding rect of the grid if found, otherwise uses the whole image. */
function detectGridBounds(binary: Uint8Array, w: number, h: number): Rect {
  // Simple approach: find the bounding box of dark pixels (the drawn grid)
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let darkCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 0) {
        darkCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (darkCount < 100) {
    // Not enough ink detected, use center square
    const size = Math.min(w, h) * 0.8;
    return { x: (w - size) / 2, y: (h - size) / 2, w: size, h: size };
  }

  // Add padding
  const pad = 5;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX + pad) - Math.max(0, minX - pad),
    h: Math.min(h, maxY + pad) - Math.max(0, minY - pad),
  };
}

/** Classify a cell region based on ink density and distribution */
function classifyCell(binary: Uint8Array, w: number, cellRect: Rect): NoteDuration {
  let totalPixels = 0;
  let darkPixels = 0;
  let darkInCenter = 0;
  let centerPixels = 0;

  const cx = cellRect.x + cellRect.w / 2;
  const cy = cellRect.y + cellRect.h / 2;
  const centerRadius = Math.min(cellRect.w, cellRect.h) * 0.3;

  // Count dark pixels in the cell, and separately in the center
  for (let y = Math.floor(cellRect.y); y < Math.floor(cellRect.y + cellRect.h); y++) {
    for (let x = Math.floor(cellRect.x); x < Math.floor(cellRect.x + cellRect.w); x++) {
      if (x < 0 || x >= w || y < 0) continue;
      totalPixels++;
      const isDark = binary[y * w + x] === 0;
      if (isDark) darkPixels++;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < centerRadius) {
        centerPixels++;
        if (isDark) darkInCenter++;
      }
    }
  }

  if (totalPixels === 0) return '1/4';

  const density = darkPixels / totalPixels;
  const centerDensity = centerPixels > 0 ? darkInCenter / centerPixels : 0;

  // Classification heuristics based on ink density:
  // - Very low density → sixteenth (small symbol)
  // - High density + filled center → quarter
  // - Moderate density hollow center → half
  // - Otherwise → eighth
  if (density < 0.05) return '1/16';
  if (density > 0.25 && centerDensity > 0.4) return '1/4';
  if (density > 0.15 && centerDensity < 0.3) return '1/2';
  if (density > 0.2) return '1/8';
  return '1/4';
}

/** Process a captured frame and return a 4x4 grid of recognized notes */
export function recognizeGrid(imageData: ImageData): NoteDuration[][] {
  const { width: w, height: h } = imageData;
  const gray = toGrayscale(imageData);
  const binary = adaptiveThreshold(gray, w, h);
  const bounds = detectGridBounds(binary, w, h);

  const cellW = bounds.w / 4;
  const cellH = bounds.h / 4;

  const result: NoteDuration[][] = [];

  for (let r = 0; r < 4; r++) {
    const row: NoteDuration[] = [];
    for (let c = 0; c < 4; c++) {
      const cellRect: Rect = {
        x: bounds.x + c * cellW + cellW * 0.1,
        y: bounds.y + r * cellH + cellH * 0.1,
        w: cellW * 0.8,
        h: cellH * 0.8,
      };
      row.push(classifyCell(binary, w, cellRect));
    }
    result.push(row);
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
  // Draw guide grid overlay
  const scale = Math.min(canvasW / videoW, canvasH / videoH);
  const gridSize = Math.min(videoW, videoH) * 0.7 * scale;
  const gx = (canvasW - gridSize) / 2;
  const gy = (canvasH - gridSize) / 2;

  ctx.strokeStyle = 'rgba(233, 69, 96, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);

  // Outer border
  ctx.strokeRect(gx, gy, gridSize, gridSize);

  // Inner grid lines
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
}
