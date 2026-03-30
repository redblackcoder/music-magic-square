# Model Training

Train a CNN to recognize hand-drawn digits (0-9) and their sums (e.g., `2+4`, `8+1`) from 28x28 grayscale images. 65 classes total: 10 single digits + 55 N+M pairs.

## Prerequisites

```bash
cd model-training
uv sync   # Install Python dependencies
```

All `uv run` commands below should be run from the `model-training/` directory.

## Workflow

### 1. Generate synthetic training data

```bash
uv run node generate-synthetic.mjs   # Creates synthetic/ (3,250 images)
```

50 samples per class with font/rotation/noise variation. Both orderings rendered for sums (e.g., `4+2` and `2+4` map to same class).

### 2. Train the model

```bash
uv run python train.py   # Full pipeline: MNIST pretrain → synthetic → export
```

This runs three phases:
1. **MNIST pre-training** (3 epochs) — conv layers learn stroke detection
2. **Synthetic fine-tuning** (20 epochs) — learns sum structure
3. **Export** → `public/cell-recognizer.onnx`

### 3. Add handwritten data and fine-tune

Place your hand-drawn images in class folders:

```
handwritten/
  1/          ← photos of handwritten "1"
  2/
  4_plus_8/   ← photos of "4+8" or "8+4"
  ...
```

Then train with fine-tuning:

```bash
uv run python train.py --handwritten handwritten   # Includes handwritten fine-tuning phase
```

### 4. Bulk import from a single photo

If you have one photo with many handwritten samples (digits and sums separated by whitespace):

```bash
uv run python split_samples.py path/to/photo.jpg
```

This splits the image on whitespace boundaries and places each sample into the appropriate `handwritten/{class}/` folder. You'll be prompted to confirm or correct the classification.

### 5. Test the trained model

Place test images in `testing/{class}/` folders (same structure as `handwritten/`), then:

```bash
uv run python test_model.py   # Evaluate model accuracy on test set
```

## All Commands

| Command | Description |
|---------|-------------|
| `uv run node generate-synthetic.mjs` | Generate synthetic training data |
| `uv run python train.py` | Train model (MNIST pretrain + synthetic) |
| `uv run python train.py --handwritten handwritten` | Train with handwritten fine-tuning |
| `uv run python test_model.py` | Evaluate model on testing/ data |
| `uv run python split_samples.py <image>` | Split a photo of samples into class folders |
| `uv run python train.py --export-only checkpoint.pt` | Export a checkpoint to ONNX |

## Directory Structure

```
classes.json            # 65 class labels + index mapping
generate-synthetic.mjs  # Node script to create synthetic data
train.py                # PyTorch training + ONNX export
test_model.py           # Model evaluation script
split_samples.py        # Bulk photo → individual samples
synthetic/              # Generated (not committed) — run `uv run generate`
handwritten/            # Your hand-drawn training samples
testing/                # Your hand-drawn test samples
checkpoint.pt           # Best model weights (generated during training)
```

## Class Naming Convention

Folder names use `_plus_` instead of `+` for filesystem safety:

| Class | Folder name |
|-------|-------------|
| `4`   | `4/` |
| `2+4` | `2_plus_4/` |
| `4+8` | `4_plus_8/` |
