# API — Grid Scan Backend

Python serverless function that detects a 4x4 grid in a photo and recognizes the math expression in each cell. Deployed as a Vercel serverless function.

## Architecture

```
scan.py                    HTTP handler (Vercel entry point)
  ├── grid_detection.py    OpenCV: find quad → perspective transform → 16 cells
  ├── cell_recognition.py  MFR model: preprocess → encode → decode → LaTeX
  └── cell_value.py        Parse LaTeX → CellValue dicts + constants
```

### Pipeline

1. **Grid detection** (`grid_detection.py`): Finds the largest quadrilateral in the image using OpenCV edge detection and contour analysis. Applies perspective transform to produce a flat, rectangular grid. Splits into 16 uniform cells. Falls back to a bounding-box heuristic if no quad is found.

2. **Cell recognition** (`cell_recognition.py`): Uses the [pix2text MFR v1.5](https://huggingface.co/breezedeus/pix2text-mfr-1.5) model — a TrOCR-based vision encoder-decoder that converts images of math expressions to LaTeX. Each cell is cropped, resized to 384x384 RGB, and normalized. All 16 cells are encoded in a single batched call, then decoded in parallel via greedy autoregressive generation.

3. **Value parsing** (`cell_value.py`): Converts the LaTeX output (e.g. `"1"`, `"1+2"`) into CellValue dicts that the frontend understands. Maps numbers to note durations: 1→1/16, 2→1/8, 4→1/4, 8→1/2.

## Endpoint

### `POST /api/scan`

**Request body:**
```json
{
  "image": "<base64-encoded JPEG>"
}
```

**Response:**
```json
{
  "values": [[CellValue, ...], ...],
  "gridFound": true,
  "quadCorners": [[x, y], [x, y], [x, y], [x, y]]
}
```

Where each CellValue is either:
- `{"kind": "single", "dur": "1/4"}` — a single note
- `{"kind": "tied", "first": "1/16", "second": "1/8"}` — two tied notes

## Model

The MFR model files are not checked into git. They are downloaded at build time (see `vercel.json`) from HuggingFace:

| File | Size | Purpose |
|------|------|---------|
| `encoder_model.onnx` | 83 MB | DeiT vision encoder (12 layers, 384 hidden) |
| `decoder_model.onnx` | 30 MB | TrOCR text decoder (6 layers, 256 hidden, 1868 vocab) |
| `tokenizer.json` | 111 KB | Fast tokenizer for LaTeX tokens |
| `generation_config.json` | 211 B | Decode parameters (BOS=1, EOS=2) |

## Local Development

### Setup

```bash
# Install Python dependencies
pip install -r api/requirements.txt

# Download model files (one-time, ~113 MB)
mkdir -p models/mfr
curl -sL -o models/mfr/encoder_model.onnx \
  https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/encoder_model.onnx
curl -sL -o models/mfr/decoder_model.onnx \
  https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/decoder_model.onnx
curl -sL -o models/mfr/tokenizer.json \
  https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/tokenizer.json
curl -sL -o models/mfr/generation_config.json \
  https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/generation_config.json
```

### Run tests

```bash
python api/test_scan.py
```

Tests the full pipeline against 10 hand-drawn/printed grid photos in `data/gridtestcases/`.

### Run locally with Vercel

```bash
vercel dev
```

## Duration Mapping

| Written | Note duration | CellValue |
|---------|--------------|-----------|
| 1 | 1/16th | `{"kind": "single", "dur": "1/16"}` |
| 2 | 1/8th | `{"kind": "single", "dur": "1/8"}` |
| 4 | Quarter | `{"kind": "single", "dur": "1/4"}` |
| 8 | Half | `{"kind": "single", "dur": "1/2"}` |
| 1+2 | Tied | `{"kind": "tied", "first": "1/16", "second": "1/8"}` |
