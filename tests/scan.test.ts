import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { createDigitRecognizer, type DigitRecognizer } from '../src/digitRecognizer';
import {
  parseCellText,
  recognizeCellFromImageData,
  detectGridBounds,
  DEFAULT_CELL,
} from '../src/imageProcessing';
import type { CellValue } from '../src/types';

const CELL_FIXTURES = path.resolve(__dirname, 'fixtures/cells');
const GRID_FIXTURES = path.resolve(__dirname, 'fixtures/grids');
const MODEL_PATH = path.resolve(__dirname, '../public/mnist-12.onnx');

// ─── Helper: load image file into ImageData ───

async function loadImageData(filePath: string): Promise<ImageData> {
  const img = await loadImage(filePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height) as unknown as ImageData;
}

// ─── parseCellText unit tests (no images needed) ───

describe('parseCellText', () => {
  it('parses single numbers', () => {
    expect(parseCellText('1')).toEqual({ kind: 'single', dur: '1/16' });
    expect(parseCellText('2')).toEqual({ kind: 'single', dur: '1/8' });
    expect(parseCellText('4')).toEqual({ kind: 'single', dur: '1/4' });
    expect(parseCellText('8')).toEqual({ kind: 'single', dur: '1/2' });
  });

  it('parses tied pairs', () => {
    expect(parseCellText('1+2')).toEqual({ kind: 'tied', first: '1/16', second: '1/8' });
    expect(parseCellText('2+4')).toEqual({ kind: 'tied', first: '1/8', second: '1/4' });
    expect(parseCellText('4+8')).toEqual({ kind: 'tied', first: '1/4', second: '1/2' });
  });

  it('normalizes order (larger first still works)', () => {
    expect(parseCellText('8+4')).toEqual({ kind: 'tied', first: '1/4', second: '1/2' });
    expect(parseCellText('2+1')).toEqual({ kind: 'tied', first: '1/16', second: '1/8' });
  });

  it('handles whitespace and OCR artifacts', () => {
    expect(parseCellText(' 4 ')).toEqual({ kind: 'single', dur: '1/4' });
    expect(parseCellText('1 + 2')).toEqual({ kind: 'tied', first: '1/16', second: '1/8' });
  });

  it('returns null for invalid input', () => {
    expect(parseCellText('')).toBeNull();
    expect(parseCellText('3')).toBeNull();
    expect(parseCellText('16')).toBeNull();
    expect(parseCellText('1+1')).toBeNull();
    expect(parseCellText('abc')).toBeNull();
  });
});

// ─── Single cell OCR tests (uses same recognizeCellFromImageData as app) ───

/**
 * Each entry: image filename → expected CellValue.
 * Images go in tests/fixtures/cells/ (png or jpg).
 *
 * Tests use recognizeCellFromImageData — the exact same function
 * the app calls for each grid cell during scanning.
 */
const CELL_CASES: { file: string; expected: CellValue }[] = [
  // Digit 1 → 1/16th note
  { file: 'mnist_1_1.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_2.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_3.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_4.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_5.png', expected: { kind: 'single', dur: '1/16' } },
  // Digit 2 → 1/8th note
  { file: 'mnist_2_1.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_2.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_3.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_4.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_5.png', expected: { kind: 'single', dur: '1/8' } },
  // Digit 4 → 1/4 quarter note
  { file: 'mnist_4_1.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_2.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_3.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_4.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_5.png', expected: { kind: 'single', dur: '1/4' } },
  // Digit 8 → 1/2 half note
  { file: 'mnist_8_1.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_2.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_3.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_4.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_5.png', expected: { kind: 'single', dur: '1/2' } },
];

describe('single cell OCR', () => {
  let recognizer: DigitRecognizer;

  beforeAll(async () => {
    recognizer = await createDigitRecognizer(MODEL_PATH);
  });

  afterAll(async () => {
    if (recognizer) await recognizer.dispose();
  });

  for (const { file, expected } of CELL_CASES) {
    const filePath = path.join(CELL_FIXTURES, file);

    if (!existsSync(filePath)) {
      it.skip(`[missing file] ${file}`, () => {});
      continue;
    }

    it(`recognizes "${file}"`, async () => {
      // Load image as ImageData (same format the app uses)
      const imageData = await loadImageData(filePath);
      // Call the same function the app calls for each cell
      const result = await recognizeCellFromImageData(
        recognizer,
        imageData,
        0, 0,
        imageData.width, imageData.height,
      );
      expect(result).toEqual(expected);
    });
  }
});

// ─── Full grid OCR tests ───

/**
 * Each entry: grid image filename → expected 4x4 CellValue[][].
 * Images go in tests/fixtures/grids/ (png or jpg).
 *
 * Tests use detectGridBounds + recognizeCellFromImageData — the same
 * pipeline the app runs when processing a captured camera frame.
 */
const GRID_CASES: { file: string; expected: CellValue[][] }[] = [
  // ← Add your test cases here
];

describe('full grid OCR', () => {
  if (GRID_CASES.length === 0) {
    it.skip('no grid test cases defined yet — add entries to GRID_CASES', () => {});
  }

  for (const { file, expected } of GRID_CASES) {
    const filePath = path.join(GRID_FIXTURES, file);

    if (!existsSync(filePath)) {
      it.skip(`[missing file] ${file}`, () => {});
      continue;
    }

    it(`recognizes grid "${file}"`, async () => {
      const imageData = await loadImageData(filePath);
      const bounds = detectGridBounds(imageData);
      const cellW = bounds.w / 4;
      const cellH = bounds.h / 4;

      const recognizer = await createDigitRecognizer(MODEL_PATH);
      const result: CellValue[][] = [];

      try {
        for (let r = 0; r < 4; r++) {
          const row: CellValue[] = [];
          for (let c = 0; c < 4; c++) {
            // Call the same function the app uses per cell
            const cell = await recognizeCellFromImageData(
              recognizer,
              imageData,
              bounds.x + c * cellW,
              bounds.y + r * cellH,
              cellW,
              cellH,
            );
            row.push(cell);
          }
          result.push(row);
        }
      } finally {
        await recognizer.dispose();
      }

      expect(result).toEqual(expected);
    });
  }
});
