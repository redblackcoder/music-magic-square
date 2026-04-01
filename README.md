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
api/                    # Python backend — grid detection + cell recognition (see its README)
  scan.py               # Vercel serverless entry point
  grid_detection.py     # OpenCV grid detection + perspective transform
  cell_recognition.py   # MFR model inference (ONNX encoder-decoder)
  cell_value.py         # LaTeX → CellValue parsing + constants
  test_scan.py          # Integration tests against real grid photos

src/                    # React app source
  components/           # UI components (GridEditor, Camera, Staff, etc.)
  types.ts              # Core data model (CellValue, NoteDuration, etc.)
  audioEngine.ts        # Tone.js playback
  gridLogic.ts          # Magic square validation

models/mfr/             # MFR model files (downloaded at build time, not in git)
model-training/         # ML model training pipeline (see its README)
tests/                  # OCR test suite (see its README)
public/                 # Static assets (fonts)
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

The camera captures a photo and sends it to a Python serverless backend (`api/scan.py`) which:
1. Detects the 4x4 grid using OpenCV (edge detection → contour analysis → perspective transform)
2. Recognizes each cell's content using the [pix2text MFR v1.5](https://huggingface.co/breezedeus/pix2text-mfr-1.5) model — a TrOCR-based math formula recognizer that converts images to LaTeX
3. Parses LaTeX expressions (e.g. `"1"`, `"1+2"`) into note durations

The camera view shows a 4x4 guide grid overlay. Write numbers in each cell, align with the guide, and tap capture. See [api/README.md](api/README.md) for backend details.

## Tech Stack

- Vite 8 + React 19 + TypeScript
- Tone.js (audio synthesis)
- Python backend: OpenCV (grid detection) + ONNX Runtime (pix2text MFR model)
- Bravura font (SMuFL music notation)
- Deployed on Vercel
