/**
 * OpenCV.js-based grid detection.
 *
 * Pipeline: grayscale → blur → Canny edges → find contours →
 * largest quadrilateral → perspective transform → 4×4 cell split.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any;

let _cv: CV | null = null;

/** Lazy-load OpenCV. Call once before using detectGrid(). */
export async function initOpenCV(): Promise<CV> {
  if (_cv) return _cv;
  // @techstark/opencv-js exports a thenable that resolves when WASM is ready
  const mod = await import('@techstark/opencv-js');
  const raw: CV = mod.default ?? mod;
  // The module itself is a thenable — await it to get the initialized cv object
  _cv = typeof raw.then === 'function' ? await raw : raw;
  return _cv;
}

export interface CellBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  col: number;
}

export interface GridDetectionResult {
  /** Perspective-corrected image of just the grid */
  warped: ImageData;
  /** 16 cell bounding boxes within the warped image (row-major order) */
  cells: CellBounds[];
  /** The 4 corners of the detected quadrilateral in the original image [tl, tr, br, bl] */
  quadCorners: [number, number][];
}

/**
 * Order 4 points as: top-left, top-right, bottom-right, bottom-left.
 * Uses sum (x+y) for TL/BR and difference (y-x) for TR/BL.
 */
function orderCorners(pts: [number, number][]): [number, number][] {
  const sorted = [...pts];
  const sums = sorted.map(([x, y]) => x + y);
  const diffs = sorted.map(([x, y]) => y - x);

  const tl = sorted[sums.indexOf(Math.min(...sums))];
  const br = sorted[sums.indexOf(Math.max(...sums))];
  const tr = sorted[diffs.indexOf(Math.min(...diffs))];
  const bl = sorted[diffs.indexOf(Math.max(...diffs))];

  return [tl, tr, br, bl];
}

/** Max dimension for contour detection (downscale large images for speed). */
const MAX_DETECT_DIM = 1024;

/**
 * Detect a 4×4 grid in an image using OpenCV edge detection and perspective transform.
 *
 * Returns the perspective-corrected grid image and 16 cell bounding boxes.
 * Falls back to a simple bounding-box approach if no quadrilateral is found.
 */
export async function detectGrid(imageData: ImageData): Promise<GridDetectionResult> {
  const cv = await initOpenCV();

  const src = cv.matFromImageData(imageData);

  // Downscale for fast contour detection, track scale factor
  const maxDim = Math.max(imageData.width, imageData.height);
  const scale = maxDim > MAX_DETECT_DIM ? MAX_DETECT_DIM / maxDim : 1;
  const small = new cv.Mat();
  if (scale < 1) {
    cv.resize(src, small, new cv.Size(
      Math.round(imageData.width * scale),
      Math.round(imageData.height * scale),
    ));
  } else {
    src.copyTo(small);
  }

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // 1. Grayscale
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);

    // 2. Blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // 3. Canny edge detection
    cv.Canny(blurred, edges, 50, 150);

    // 4. Dilate edges to close gaps in grid lines
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.dilate(edges, edges, kernel);
    kernel.delete();

    // 5. Find contours
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 6. Find the largest quadrilateral contour
    let bestQuad: [number, number][] | null = null;
    let bestArea = 0;
    const smallArea = small.cols * small.rows;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Skip tiny contours (< 5% of image area)
      if (area < smallArea * 0.05) continue;

      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestArea) {
        bestArea = area;
        bestQuad = [];
        for (let j = 0; j < 4; j++) {
          // Scale coordinates back to original resolution
          bestQuad.push([
            Math.round(approx.intAt(j, 0) / scale),
            Math.round(approx.intAt(j, 1) / scale),
          ]);
        }
      }
      approx.delete();
    }

    small.delete();

    if (!bestQuad) {
      return fallbackDetection(cv, src, imageData);
    }

    // 7. Order corners: TL, TR, BR, BL
    const ordered = orderCorners(bestQuad);

    // 8. Compute output size
    const widthTop = Math.hypot(ordered[1][0] - ordered[0][0], ordered[1][1] - ordered[0][1]);
    const widthBot = Math.hypot(ordered[2][0] - ordered[3][0], ordered[2][1] - ordered[3][1]);
    const heightLeft = Math.hypot(ordered[3][0] - ordered[0][0], ordered[3][1] - ordered[0][1]);
    const heightRight = Math.hypot(ordered[2][0] - ordered[1][0], ordered[2][1] - ordered[1][1]);

    const outW = Math.round(Math.max(widthTop, widthBot));
    const outH = Math.round(Math.max(heightLeft, heightRight));

    // 9. Perspective transform (on full-resolution image)
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flat());
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outW, 0,
      outW, outH,
      0, outH,
    ]);

    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(outW, outH));

    // 10. Convert warped Mat to ImageData
    const warpedRGBA = new cv.Mat();
    if (warped.channels() === 4) {
      warped.copyTo(warpedRGBA);
    } else {
      cv.cvtColor(warped, warpedRGBA, cv.COLOR_BGR2RGBA);
    }

    const warpedImageData = new ImageData(
      new Uint8ClampedArray(warpedRGBA.data),
      outW,
      outH,
    );

    // 11. Compute 16 cell bounds (uniform 4×4 split)
    const cellW = outW / 4;
    const cellH = outH / 4;
    const cells: CellBounds[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cells.push({
          x: Math.round(c * cellW),
          y: Math.round(r * cellH),
          w: Math.round(cellW),
          h: Math.round(cellH),
          row: r,
          col: c,
        });
      }
    }

    // Cleanup
    srcPts.delete();
    dstPts.delete();
    M.delete();
    warped.delete();
    warpedRGBA.delete();

    return { warped: warpedImageData, cells, quadCorners: ordered };
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

/** Fallback when no quadrilateral is found: bounding box of all dark pixels. */
function fallbackDetection(cv: CV, src: CV, imageData: ImageData): GridDetectionResult {
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

  let bx: number, by: number, bw: number, bh: number;
  if (darkCount < 100) {
    const size = Math.min(w, h) * 0.8;
    bx = (w - size) / 2;
    by = (h - size) / 2;
    bw = size;
    bh = size;
  } else {
    const pad = 5;
    bx = Math.max(0, minX - pad);
    by = Math.max(0, minY - pad);
    bw = Math.min(w, maxX + pad) - bx;
    bh = Math.min(h, maxY + pad) - by;
  }

  // Extract the region as the "warped" image
  const roi = src.roi(new cv.Rect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)));
  const roiRGBA = new cv.Mat();
  if (roi.channels() === 4) {
    roi.copyTo(roiRGBA);
  } else {
    cv.cvtColor(roi, roiRGBA, cv.COLOR_BGR2RGBA);
  }

  const roiW = Math.round(bw);
  const roiH = Math.round(bh);
  const warpedImageData = new ImageData(
    new Uint8ClampedArray(roiRGBA.data),
    roiW,
    roiH,
  );

  roi.delete();
  roiRGBA.delete();

  const cellW = roiW / 4;
  const cellH = roiH / 4;
  const cells: CellBounds[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push({
        x: Math.round(c * cellW),
        y: Math.round(r * cellH),
        w: Math.round(cellW),
        h: Math.round(cellH),
        row: r,
        col: c,
      });
    }
  }

  const corners: [number, number][] = [
    [bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh],
  ];

  return { warped: warpedImageData, cells, quadCorners: corners };
}
