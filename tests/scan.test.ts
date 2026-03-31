import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { createCellRecognizer, type CellRecognizer } from '../src/digitRecognizer';
import {
  parseCellText,
  recognizeCellFromImageData,
  DEFAULT_CELL,
} from '../src/imageProcessing';
import type { CellValue } from '../src/types';

const CELL_FIXTURES = path.resolve(__dirname, 'fixtures/cells');
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

const CELL_CASES: { file: string; expected: CellValue }[] = [
  { file: 'mnist_1_1.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_2.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_3.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_4.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_1_5.png', expected: { kind: 'single', dur: '1/16' } },
  { file: 'mnist_2_1.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_2.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_3.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_4.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_2_5.png', expected: { kind: 'single', dur: '1/8' } },
  { file: 'mnist_4_1.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_2.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_3.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_4.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_4_5.png', expected: { kind: 'single', dur: '1/4' } },
  { file: 'mnist_8_1.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_2.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_3.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_4.png', expected: { kind: 'single', dur: '1/2' } },
  { file: 'mnist_8_5.png', expected: { kind: 'single', dur: '1/2' } },
];

describe('single cell OCR', () => {
  let recognizer: CellRecognizer;

  beforeAll(async () => {
    const DIGIT_LABELS = ['0','1','2','3','4','5','6','7','8','9'];
    recognizer = await createCellRecognizer(MODEL_PATH, DIGIT_LABELS);
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
      const imageData = await loadImageData(filePath);
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

// ─── Grid detection tests ───
// Grid detection uses OpenCV which doesn't work in Node.js.
// Run tests/test_grid_detection.py instead:
//   cd model-training && uv run python ../tests/test_grid_detection.py
