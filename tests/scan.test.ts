import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import Tesseract from 'tesseract.js';
import { createCanvas, loadImage } from 'canvas';
import {
  parseCellText,
  createOcrWorker,
  recognizeImage,
  detectGridBounds,
  DEFAULT_CELL,
} from '../src/imageProcessing';
import type { CellValue } from '../src/types';

const CELL_FIXTURES = path.resolve(__dirname, 'fixtures/cells');
const GRID_FIXTURES = path.resolve(__dirname, 'fixtures/grids');

// ─── Helper: load an image file into something Tesseract can consume ───

async function loadImageBuffer(filePath: string): Promise<Buffer> {
  const img = await loadImage(filePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toBuffer('image/png');
}

async function loadImageData(filePath: string) {
  const img = await loadImage(filePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
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
    expect(parseCellText('1+1')).toBeNull(); // not a valid pair
    expect(parseCellText('abc')).toBeNull();
  });
});

// ─── Single cell OCR tests (data-driven, user supplies images) ───

/**
 * Add test cases here. Each entry maps an image filename to its expected value.
 *
 * Image files go in: tests/fixtures/cells/
 * Supported formats: .png, .jpg, .jpeg
 *
 * The filename is just for identification — the expected value is what matters.
 *
 * Example:
 *   { file: 'eight.png', expected: { kind: 'single', dur: '1/2' } },
 *   { file: 'one_plus_two.jpg', expected: { kind: 'tied', first: '1/16', second: '1/8' } },
 */
const CELL_CASES: { file: string; expected: CellValue }[] = [
  // ← Add your test cases here
];

describe('single cell OCR', () => {
  let worker: Tesseract.Worker;

  // Filter to only cases whose files actually exist
  const activeCases = CELL_CASES.filter(({ file }) =>
    existsSync(path.join(CELL_FIXTURES, file)),
  );

  beforeAll(async () => {
    if (activeCases.length === 0) return;
    worker = await createOcrWorker();
  });

  afterAll(async () => {
    if (worker) await worker.terminate();
  });

  if (CELL_CASES.length === 0) {
    it.skip('no cell test cases defined yet — add entries to CELL_CASES', () => {});
  }

  for (const { file, expected } of CELL_CASES) {
    const filePath = path.join(CELL_FIXTURES, file);

    if (!existsSync(filePath)) {
      it.skip(`[missing file] ${file}`, () => {});
      continue;
    }

    it(`recognizes "${file}"`, async () => {
      const buffer = await loadImageBuffer(filePath);
      const result = await recognizeImage(worker, buffer);
      expect(result ?? DEFAULT_CELL).toEqual(expected);
    });
  }
});

// ─── Full grid OCR tests (data-driven, user supplies images) ───

/**
 * Add test cases here. Each entry maps a grid image to the expected 4x4 result.
 *
 * Image files go in: tests/fixtures/grids/
 * Supported formats: .png, .jpg, .jpeg
 *
 * Example:
 *   {
 *     file: 'grid1.png',
 *     expected: [
 *       [{ kind: 'single', dur: '1/2' }, { kind: 'single', dur: '1/4' }, { kind: 'single', dur: '1/16' }, { kind: 'tied', first: '1/8', second: '1/16' }],
 *       [{ kind: 'single', dur: '1/16' }, { kind: 'tied', first: '1/8', second: '1/16' }, { kind: 'single', dur: '1/2' }, { kind: 'single', dur: '1/4' }],
 *       [{ kind: 'tied', first: '1/8', second: '1/16' }, { kind: 'single', dur: '1/16' }, { kind: 'single', dur: '1/4' }, { kind: 'single', dur: '1/2' }],
 *       [{ kind: 'single', dur: '1/4' }, { kind: 'single', dur: '1/2' }, { kind: 'tied', first: '1/8', second: '1/16' }, { kind: 'single', dur: '1/16' }],
 *     ],
 *   },
 */
const GRID_CASES: { file: string; expected: CellValue[][] }[] = [
  // ← Add your test cases here
];

describe('full grid OCR', () => {
  // Filter to only cases whose files actually exist
  const activeCases = GRID_CASES.filter(({ file }) =>
    existsSync(path.join(GRID_FIXTURES, file)),
  );

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
      const bounds = detectGridBounds(imageData as unknown as ImageData);
      const cellW = Math.floor(bounds.w / 4);
      const cellH = Math.floor(bounds.h / 4);

      const worker = await createOcrWorker();
      const result: CellValue[][] = [];

      try {
        for (let r = 0; r < 4; r++) {
          const row: CellValue[] = [];
          for (let c = 0; c < 4; c++) {
            // Crop each cell with 10% inset to avoid grid lines
            const cx = Math.floor(bounds.x + c * cellW + cellW * 0.1);
            const cy = Math.floor(bounds.y + r * cellH + cellH * 0.1);
            const cw = Math.floor(cellW * 0.8);
            const ch = Math.floor(cellH * 0.8);

            const img = await loadImage(filePath);
            const canvas = createCanvas(cw, ch);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

            const buffer = canvas.toBuffer('image/png');
            const parsed = await recognizeImage(worker, buffer);
            row.push(parsed ?? DEFAULT_CELL);
          }
          result.push(row);
        }
      } finally {
        await worker.terminate();
      }

      expect(result).toEqual(expected);
    });
  }
});
