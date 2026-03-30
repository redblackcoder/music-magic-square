# Music Magic Square

A mobile-first PWA where you draw a 4x4 grid of numbers, scan it with your camera, and hear it played as music. Each row, column, and diagonal must sum to one bar in 4/4 time — a musical magic square.

## How It Works

Each cell holds a number representing note duration in sixteenths:

| Number | Note     | Duration |
|--------|----------|----------|
| 1      | 1/16th   | 1 beat   |
| 2      | 1/8th    | 2 beats  |
| 4      | Quarter  | 4 beats  |
| 8      | Half     | 8 beats  |

Tied notes (e.g., `2+4`, `4+8`) combine two durations. Every row, column, and diagonal must sum to 16 (one bar).

## Quick Start

```bash
npm install
npm run dev        # Start dev server
npm run build      # Production build
npm test           # Run OCR tests
```

## Project Structure

```
src/                    # React app source
  components/           # UI components (GridEditor, Camera, Staff, etc.)
  types.ts              # Core data model (CellValue, NoteDuration, etc.)
  imageProcessing.ts    # Grid detection + OCR recognition
  digitRecognizer.ts    # ONNX model inference (browser + Node)
  audioEngine.ts        # Tone.js playback
  gridLogic.ts          # Magic square validation

model-training/         # ML model training pipeline (see its README)
tests/                  # OCR test suite (see its README)
public/                 # Static assets (fonts, ONNX models)
scripts/                # Utility scripts
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm test` | Run OCR recognition tests |
| `npm run lint` | ESLint check |

## Model Training

See [model-training/README.md](model-training/README.md) for the full ML pipeline: synthetic data generation, PyTorch training with MNIST transfer learning, and ONNX export.

## Scanning

The app uses ONNX Runtime to recognize hand-drawn digits and sums:
- **cell-recognizer.onnx** (65 classes) — digits 0-9 + all N+M sums
- **mnist-12.onnx** (10 classes) — fallback, single digits only

The camera view shows a 4x4 guide grid overlay. Write numbers in each cell, align with the guide, and tap capture.

## Tech Stack

- Vite 8 + React 19 + TypeScript
- Tone.js (audio synthesis)
- ONNX Runtime Web (digit recognition)
- Bravura font (SMuFL music notation)
- Deployed on Vercel
