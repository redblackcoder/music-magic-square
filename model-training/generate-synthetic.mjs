/**
 * Generate synthetic training data for digit + sum recognizer.
 *
 * Classes:
 *   - 10 single digits: 0-9
 *   - 55 sums (N+M where N<=M): 0+0, 0+1, ..., 9+9
 *   - Total: 65 classes
 *
 * For sum classes where N != M, half the samples are rendered in
 * reverse order (e.g., "4+2" for class "2+4") so the model learns
 * that order doesn't matter.
 *
 * Images are 28x28 grayscale PNG (white-on-black, MNIST convention).
 * Sum expressions render each component (digit, +, digit) separately
 * with controlled spacing to stay legible at 28x28.
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// Build class list
const CLASSES = [];
for (let d = 0; d <= 9; d++) CLASSES.push(String(d));
for (let a = 0; a <= 9; a++) {
  for (let b = a; b <= 9; b++) {
    CLASSES.push(`${a}+${b}`);
  }
}

const SAMPLES_PER_CLASS = 200;
const IMG_SIZE = 28;
const OUTPUT_DIR = path.resolve('model-training/synthetic');

const FONTS = [
  'sans-serif', 'serif', 'monospace', 'Georgia',
  'Courier New', 'Arial', 'Helvetica', 'Times New Roman',
];

// Stroke weight variations: some fonts look bolder/thinner
const WEIGHTS = ['bold', '900', '700', 'normal'];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

/**
 * Render a single digit at high resolution.
 */
function renderDigitSample(label) {
  const hiRes = 224;
  const canvas = createCanvas(hiRes, hiRes);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, hiRes, hiRes);

  const angle = rand(-10, 10) * (Math.PI / 180);
  const scale = rand(0.82, 1.08);
  const dx = rand(-12, 12);
  const dy = rand(-12, 12);

  ctx.save();
  ctx.translate(hiRes / 2 + dx, hiRes / 2 + dy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  const font = pick(FONTS);
  const weight = pick(WEIGHTS);
  const fontSize = rand(90, 140);

  ctx.font = `${weight} ${fontSize}px ${font}`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();

  return canvas;
}

/**
 * Render a sum expression (e.g. "2+4") by drawing each component separately.
 * This gives much better control over sizing and spacing than fillText("2+4").
 */
function renderSumSample(label) {
  const hiRes = 224;
  const canvas = createCanvas(hiRes, hiRes);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, hiRes, hiRes);

  const [left, right] = label.split('+');
  const font = pick(FONTS);
  const weight = pick(WEIGHTS);

  // Digits rendered large, + sign smaller
  const digitSize = rand(70, 95);
  const plusSize = rand(50, 70);
  const gap = rand(2, 12); // spacing between components

  const angle = rand(-8, 8) * (Math.PI / 180);
  const scale = rand(0.85, 1.05);
  const dx = rand(-8, 8);
  const dy = rand(-8, 8);

  ctx.save();
  ctx.translate(hiRes / 2 + dx, hiRes / 2 + dy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Measure widths to center the whole expression
  ctx.font = `${weight} ${digitSize}px ${font}`;
  const leftW = ctx.measureText(left).width;
  const rightW = ctx.measureText(right).width;
  ctx.font = `${weight} ${plusSize}px ${font}`;
  const plusW = ctx.measureText('+').width;

  const totalW = leftW + gap + plusW + gap + rightW;
  let x = -totalW / 2;

  // Draw left digit
  ctx.font = `${weight} ${digitSize}px ${font}`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(left, x, 0);
  x += leftW + gap;

  // Draw + sign (slightly smaller, vertically centered)
  ctx.font = `${weight} ${plusSize}px ${font}`;
  ctx.fillText('+', x, 0);
  x += plusW + gap;

  // Draw right digit
  ctx.font = `${weight} ${digitSize}px ${font}`;
  ctx.fillText(right, x, 0);

  ctx.restore();
  return canvas;
}

/**
 * Render a label at high resolution then downscale to 28x28 with post-processing.
 */
function renderSample(label) {
  const hiRes = 224;
  const isSum = label.includes('+');
  const canvas = isSum ? renderSumSample(label) : renderDigitSample(label);

  // Downscale to 28x28 with smoothing
  const out = createCanvas(IMG_SIZE, IMG_SIZE);
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(canvas, 0, 0, IMG_SIZE, IMG_SIZE);

  // Post-processing: noise + slight brightness variation
  const imageData = outCtx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
  const d = imageData.data;
  const noiseLevel = rand(0, 15);
  const brightnessMult = rand(0.8, 1.0); // simulate faded ink

  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseLevel;
    let val = d[i] * brightnessMult + noise;
    val = Math.max(0, Math.min(255, val));
    d[i] = d[i + 1] = d[i + 2] = val;
    d[i + 3] = 255;
  }

  outCtx.putImageData(imageData, 0, 0);
  return out;
}

// Write class index
const classIndex = {};
CLASSES.forEach((c, i) => { classIndex[c] = i; });
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(
  path.join(OUTPUT_DIR, '..', 'classes.json'),
  JSON.stringify({ classes: CLASSES, index: classIndex }, null, 2),
);

// Generate
console.log(`Generating ${SAMPLES_PER_CLASS} samples × ${CLASSES.length} classes = ${SAMPLES_PER_CLASS * CLASSES.length} images...`);

let total = 0;
for (const label of CLASSES) {
  const dirName = label.replace('+', '_plus_');
  const classDir = path.join(OUTPUT_DIR, dirName);
  mkdirSync(classDir, { recursive: true });

  for (let i = 0; i < SAMPLES_PER_CLASS; i++) {
    let renderLabel = label;
    if (label.includes('+')) {
      const [a, b] = label.split('+');
      if (a !== b && Math.random() > 0.5) {
        renderLabel = `${b}+${a}`;
      }
    }
    const canvas = renderSample(renderLabel);
    const buf = canvas.toBuffer('image/png');
    writeFileSync(path.join(classDir, `${i.toString().padStart(4, '0')}.png`), buf);
  }

  total += SAMPLES_PER_CLASS;
  if ((CLASSES.indexOf(label) + 1) % 10 === 0) {
    console.log(`  ${CLASSES.indexOf(label) + 1}/${CLASSES.length} classes done...`);
  }
}

console.log(`\nDone! ${total} images in ${OUTPUT_DIR} (${SAMPLES_PER_CLASS}/class)`);
console.log(`Class index written to model-training/classes.json (${CLASSES.length} classes)`);
