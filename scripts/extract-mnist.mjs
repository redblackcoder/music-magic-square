/**
 * Extract specific MNIST digits as PNG files for OCR testing.
 * Picks 5 samples each for digits 1, 2, 4, 8.
 */
import { readFileSync, mkdirSync } from 'fs';
import { createCanvas } from 'canvas';
import path from 'path';

const IMAGES_FILE = path.resolve('data/t10k-images.idx3-ubyte');
const LABELS_FILE = path.resolve('data/t10k-labels.idx1-ubyte');
const OUTPUT_DIR = path.resolve('tests/fixtures/cells');

const WANTED_DIGITS = [1, 2, 4, 8];
const SAMPLES_PER_DIGIT = 5;

// Parse MNIST idx format
const imgBuf = readFileSync(IMAGES_FILE);
const lblBuf = readFileSync(LABELS_FILE);

const numImages = imgBuf.readUInt32BE(4);
const rows = imgBuf.readUInt32BE(8);   // 28
const cols = imgBuf.readUInt32BE(12);  // 28
const imgOffset = 16;
const lblOffset = 8;

console.log(`MNIST: ${numImages} images, ${rows}x${cols}`);

mkdirSync(OUTPUT_DIR, { recursive: true });

const counts = {};
for (const d of WANTED_DIGITS) counts[d] = 0;

for (let i = 0; i < numImages; i++) {
  const label = lblBuf[lblOffset + i];
  if (!WANTED_DIGITS.includes(label)) continue;
  if (counts[label] >= SAMPLES_PER_DIGIT) continue;

  counts[label]++;
  const sampleIdx = counts[label];

  // Extract 28x28 pixel data
  const pixelStart = imgOffset + i * rows * cols;

  // Render to a larger canvas (56x56) for better OCR readability
  const scale = 4;
  const canvas = createCanvas(cols * scale, rows * scale);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each MNIST pixel as a scaled block (inverted: MNIST is white-on-black)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const val = imgBuf[pixelStart + y * cols + x];
      // MNIST: 0 = background (white), 255 = foreground (black)
      const gray = 255 - val;
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  const filename = `mnist_${label}_${sampleIdx}.png`;
  const outPath = path.join(OUTPUT_DIR, filename);
  const pngBuf = canvas.toBuffer('image/png');
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, pngBuf);
  console.log(`  Wrote ${filename}`);

  // Check if we have enough
  if (WANTED_DIGITS.every(d => counts[d] >= SAMPLES_PER_DIGIT)) break;
}

console.log('Done:', counts);
