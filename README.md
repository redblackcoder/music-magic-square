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

See [api/README.md](api/README.md) for backend details.

### Camera System

The camera view (`src/components/Camera.tsx`) shows a dashed guide overlay that the user aligns their paper grid to. Three key parameters control the experience: **zoom level**, **guide overlay size**, and **capture crop region**. All three are derived from a physical model of the scanning setup.

#### Physical Model

| Parameter | Value | Source |
|-----------|-------|--------|
| Grid on paper | ~13 cm square | User-measured (12–15 cm range) |
| Holding distance | ~30 cm | Comfortable arm-above-desk position |
| Rear camera focal length | 26 mm equivalent | Typical for iPhone and most Android phones |
| Video aspect ratio | 16:9 portrait | Most common `getUserMedia` output |

#### Zoom Level

**Problem**: Many phones (especially Samsung) apply a default 1.5–2x digital zoom when the rear camera is accessed through the browser. This narrows the effective field of view and forces the user to hold the phone much further from the paper.

**Solution**: After acquiring the camera stream, we reset zoom to the hardware minimum:

```
track.getCapabilities().zoom → { min, max, step }
track.applyConstraints({ advanced: [{ zoom: min }] })
```

**Why this matters** — FOV calculation at 30 cm distance:

The 26 mm equivalent focal length on a 36×24 mm full-frame reference gives:
- Landscape horizontal FOV = 2 × arctan(36 / (2 × 26)) ≈ 69°
- 16:9 crop vertical FOV = 2 × arctan(20.25 / (2 × 26)) ≈ 42.5°
- In portrait orientation, the narrow axis (screen width) has the 42.5° FOV

Visible width at 30 cm = 2 × 30 × tan(42.5° / 2) ≈ **23.3 cm**

| Zoom level | Effective visible width | 13 cm grid fills |
|------------|----------------------|-------------------|
| 1.0× (native) | 23.3 cm | 56% of frame |
| 1.5× (common default) | 15.5 cm | 84% of frame — barely fits |
| 2.0× | 11.7 cm | Doesn't fit at all |

Resetting to `zoom.min` restores the native ~23 cm visible width, giving comfortable margin for grid alignment.

#### Guide Overlay Size

The dashed square overlay is sized at **65% of the viewport's smaller dimension** (`65vmin` in CSS, `GUIDE_FRACTION = 0.65` in TypeScript).

**Derivation**: A larger guide maximises the captured area sent to the backend, improving OCR accuracy. At zoom 1.0× with 26 mm equivalent, the 13 cm grid occupies ~56% of horizontal frame width. A 65vmin guide covers most of the visible area while still leaving margin for alignment. The 10% capture padding (see below) extends this further.

#### Capture Crop

When the user taps capture, the app crops the video frame to the guide overlay region (not the full frame). The mapping accounts for `object-fit: contain` letterboxing:

1. Calculate the guide overlay rectangle in display coordinates (centered, 65vmin square)
2. Map from display coordinates → visible video coordinates → full video pixel coordinates, accounting for any letterboxing from `object-fit: contain`
3. Add **10% padding** around the crop to give the grid detection algorithm room for edge detection

The cropped JPEG is sent to the backend. This means the backend receives a tightly-framed image of just the grid area rather than the full camera frame, improving detection accuracy and reducing transfer size.

## Tech Stack

- Vite 8 + React 19 + TypeScript
- Tone.js (audio synthesis)
- Python backend: OpenCV (grid detection) + ONNX Runtime (pix2text MFR model)
- Bravura font (SMuFL music notation)
- Deployed on Vercel
