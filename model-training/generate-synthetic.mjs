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
 * Kept to 50 samples/class to avoid overfitting and preserve MNIST pre-training.
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

// Low count to complement (not replace) MNIST pre-training
const SAMPLES_PER_CLASS = 50;
const IMG_SIZE = 28;
const OUTPUT_DIR = path.resolve('model-training/synthetic');

const FONTS = [
  'sans-serif', 'serif', 'monospace', 'Georgia',
  'Courier New', 'Arial', 'Helvetica', 'Times New Roman',
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/**
 * Render a label at high resolution then downscale to 28x28.
 * Uses 224px intermediate canvas (8x) for clean anti-aliasing.
 * Large bold fonts so text is clearly readable even at 28x28.
 */
function renderSample(label) {
  const hiRes = 224;
  const canvas = createCanvas(hiRes, hiRes);
  const ctx = canvas.getContext('2d');

  // Black background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, hiRes, hiRes);

  // Mild random transform — keep it readable
  const angle = rand(-8, 8) * (Math.PI / 180);
  const scale = rand(0.85, 1.05);
  const dx = rand(-8, 8);
  const dy = rand(-8, 8);

  ctx.save();
  ctx.translate(hiRes / 2 + dx, hiRes / 2 + dy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  const font = FONTS[randInt(0, FONTS.length - 1)];
  const isSum = label.includes('+');

  // Large bold fonts — sums get slightly smaller to fit the "+"
  const baseFontSize = isSum ? rand(52, 68) : rand(90, 130);

  ctx.font = `bold ${baseFontSize}px ${font}`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();

  // Downscale to 28x28 with smoothing
  const out = createCanvas(IMG_SIZE, IMG_SIZE);
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(canvas, 0, 0, IMG_SIZE, IMG_SIZE);

  // Light noise only
  const imageData = outCtx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
  const d = imageData.data;
  const noiseLevel = rand(0, 10);

  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseLevel;
    const val = Math.max(0, Math.min(255, d[i] + noise));
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

console.log(`\nDone! ${total} images in ${OUTPUT_DIR}`);
console.log(`Class index written to model-training/classes.json (${CLASSES.length} classes)`);
