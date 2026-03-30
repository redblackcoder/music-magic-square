/**
 * MNIST-based digit recognition using ONNX Runtime.
 *
 * Uses the official MNIST ONNX model (26 KB) to classify 28x28 grayscale
 * digit images. Works in both browser (onnxruntime-web) and Node (onnxruntime-node).
 */

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

export interface DigitRecognizer {
  /** Classify a 28x28 grayscale image. Returns digit 0-9 and confidence. */
  recognize(pixels: Float32Array): Promise<{ digit: number; confidence: number }>;
  /** Release resources */
  dispose(): Promise<void>;
}

/**
 * Create a digit recognizer backed by the MNIST ONNX model.
 * @param modelPath Path or URL to mnist-12.onnx
 */
export async function createDigitRecognizer(modelPath: string): Promise<DigitRecognizer> {
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

      const digit = probs.indexOf(Math.max(...probs));
      const confidence = probs[digit];

      return { digit, confidence };
    },

    async dispose() {
      await session.release();
    },
  };
}

/**
 * Convert a grayscale image region to a 28x28 Float32Array for MNIST.
 * Expects black-on-white (paper) — inverts to white-on-black (MNIST convention).
 *
 * @param getPixel Function that returns grayscale value [0-255] at (x, y)
 * @param width Source image width
 * @param height Source image height
 */
export function prepareDigitInput(
  getPixel: (x: number, y: number) => number,
  width: number,
  height: number,
): Float32Array {
  const pixels = new Float32Array(28 * 28);

  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      // Map from 28x28 to source dimensions
      const sx = Math.floor((x / 28) * width);
      const sy = Math.floor((y / 28) * height);
      const gray = getPixel(sx, sy);
      // Invert: black-on-white paper → white-on-black MNIST
      pixels[y * 28 + x] = (255 - gray) / 255;
    }
  }

  return pixels;
}
