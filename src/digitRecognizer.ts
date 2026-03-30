/**
 * Cell recognizer using ONNX Runtime.
 *
 * Supports two models:
 * - mnist-12.onnx: 10-class digit recognition (0-9)
 * - cell-recognizer.onnx: 65-class (10 digits + 55 sums like "2+4")
 *
 * Works in both browser (onnxruntime-web) and Node (onnxruntime-node).
 */

import classData from '../model-training/classes.json';

// Conditional import: use onnxruntime-node in Node, onnxruntime-web in browser
const isNode = typeof window === 'undefined';

type OrtModule = typeof import('onnxruntime-web');

let _ort: OrtModule | null = null;

async function getOrt(): Promise<OrtModule> {
  if (_ort) return _ort;
  if (isNode) {
    _ort = await import('onnxruntime-node') as unknown as OrtModule;
  } else {
    _ort = await import('onnxruntime-web');
  }
  return _ort;
}

/** The 65 class labels from training */
export const CLASS_LABELS: string[] = classData.classes;

export interface RecognitionResult {
  /** The class label (e.g., "4", "2+8") */
  label: string;
  /** Index into CLASS_LABELS */
  classIndex: number;
  /** Softmax confidence 0-1 */
  confidence: number;
}

export interface CellRecognizer {
  /** Classify a 28x28 grayscale image. */
  recognize(pixels: Float32Array): Promise<RecognitionResult>;
  /** Release resources */
  dispose(): Promise<void>;
}

/**
 * Create a cell recognizer backed by an ONNX model.
 * @param modelPath Path or URL to the .onnx model file
 * @param labels Class labels array (defaults to 65-class labels from classes.json)
 */
export async function createCellRecognizer(
  modelPath: string,
  labels: string[] = CLASS_LABELS,
): Promise<CellRecognizer> {
  const ort = await getOrt();
  const session = await ort.InferenceSession.create(modelPath);

  return {
    async recognize(pixels: Float32Array) {
      const input = new ort.Tensor('float32', pixels, [1, 1, 28, 28]);
      const results = await session.run({ [session.inputNames[0]]: input });
      const output = results[session.outputNames[0]].data as Float32Array;

      // Softmax
      const maxVal = Math.max(...output);
      const exps = Array.from(output).map(v => Math.exp(v - maxVal));
      const sum = exps.reduce((a, b) => a + b);
      const probs = exps.map(v => v / sum);

      const classIndex = probs.indexOf(Math.max(...probs));
      const confidence = probs[classIndex];
      const label = labels[classIndex] ?? String(classIndex);

      return { label, classIndex, confidence };
    },

    async dispose() {
      await session.release();
    },
  };
}

// ── Legacy 10-class MNIST support ──

export interface DigitRecognizer {
  recognize(pixels: Float32Array): Promise<{ digit: number; confidence: number }>;
  dispose(): Promise<void>;
}

const DIGIT_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Create a recognizer for the 10-class MNIST model */
export async function createDigitRecognizer(modelPath: string): Promise<DigitRecognizer> {
  const inner = await createCellRecognizer(modelPath, DIGIT_LABELS);
  return {
    async recognize(pixels) {
      const r = await inner.recognize(pixels);
      return { digit: r.classIndex, confidence: r.confidence };
    },
    dispose: () => inner.dispose(),
  };
}

/**
 * Convert a grayscale image region to a 28x28 Float32Array.
 * Expects black-on-white (paper) — inverts to white-on-black (MNIST convention).
 */
export function prepareDigitInput(
  getPixel: (x: number, y: number) => number,
  width: number,
  height: number,
): Float32Array {
  const pixels = new Float32Array(28 * 28);

  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const sx = Math.floor((x / 28) * width);
      const sy = Math.floor((y / 28) * height);
      const gray = getPixel(sx, sy);
      pixels[y * 28 + x] = (255 - gray) / 255;
    }
  }

  return pixels;
}
