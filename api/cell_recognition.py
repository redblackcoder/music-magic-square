"""
Two-pass cell recognition pipeline.

Pass 1: MNIST model (28x28 grayscale, 10-class digit recognition).
  Fast and accurate for single digits {1, 2, 4, 8}. Cells recognized
  with high confidence are accepted immediately.

Pass 2: pix2text MFR model (384x384 RGB, LaTeX output).
  Used only for cells that MNIST couldn't classify — typically tied
  expressions like "1+2", "4+8" that aren't single digits.
"""

import os

import numpy as np
import cv2
import onnxruntime as ort
from tokenizers import Tokenizer

from cell_value import latex_to_cell_value, NUM_TO_DUR, VALID_SINGLES

# ── Constants ──

CELL_INSET = 0.10  # crop 10% from each edge to avoid grid lines
MNIST_CONFIDENCE = 0.60  # min softmax confidence to accept MNIST prediction

# MFR preprocessing (from preprocessor_config.json)
MFR_IMAGE_SIZE = 384
MFR_MEAN = np.array([0.5, 0.5, 0.5], dtype=np.float32)
MFR_STD = np.array([0.5, 0.5, 0.5], dtype=np.float32)

# MFR generation (from generation_config.json)
DECODER_START_TOKEN_ID = 1
EOS_TOKEN_ID = 2
MAX_NEW_TOKENS = 20

# ── Module-level session cache ──

_project_root = os.path.join(os.path.dirname(__file__), "..")
_mnist_session = None
_mfr_encoder = None
_mfr_decoder = None
_mfr_tokenizer = None


def _get_mnist():
    """Load and cache the MNIST digit recognizer."""
    global _mnist_session
    if _mnist_session is not None:
        return _mnist_session

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1

    path = os.path.join(_project_root, "public", "mnist-12.onnx")
    _mnist_session = ort.InferenceSession(path, opts)
    print(f"[mnist] loaded: {path}")
    return _mnist_session


def _get_mfr():
    """Load and cache the MFR encoder, decoder, and tokenizer."""
    global _mfr_encoder, _mfr_decoder, _mfr_tokenizer
    if _mfr_encoder is not None:
        return _mfr_encoder, _mfr_decoder, _mfr_tokenizer

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1

    mfr_dir = os.path.join(_project_root, "models", "mfr")
    _mfr_encoder = ort.InferenceSession(os.path.join(mfr_dir, "encoder_model.onnx"), opts)
    _mfr_decoder = ort.InferenceSession(os.path.join(mfr_dir, "decoder_model.onnx"), opts)
    _mfr_tokenizer = Tokenizer.from_file(os.path.join(mfr_dir, "tokenizer.json"))
    print(f"[mfr] loaded encoder + decoder from {mfr_dir}")
    return _mfr_encoder, _mfr_decoder, _mfr_tokenizer


# ── Cell extraction ──


def _extract_cell_gray(warped_gray, cell):
    """Extract a single cell region with inset, return grayscale crop."""
    x, y, w, h = cell["x"], cell["y"], cell["w"], cell["h"]
    cx = int(x + w * CELL_INSET)
    cy = int(y + h * CELL_INSET)
    cw = int(w * (1 - 2 * CELL_INSET))
    ch = int(h * (1 - 2 * CELL_INSET))
    return warped_gray[cy : cy + ch, cx : cx + cw]


def _clean_binary(gray_cell):
    """
    Binarize a cell image: adaptive threshold + noise removal.
    Returns (binary_mask, bounding_rect_or_None).
    binary_mask has ink as white (255) on black background.
    """
    binary = cv2.adaptiveThreshold(
        gray_cell, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 15
    )
    noise_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, noise_kernel)

    coords = cv2.findNonZero(binary)
    if coords is None:
        return binary, None
    return binary, cv2.boundingRect(coords)


def _center_on_white(binary, bbox):
    """
    Crop binary content at bbox and center it on a white square canvas
    with 25% padding on each side.
    """
    bx, by, bw, bh = bbox
    content = 255 - binary[by : by + bh, bx : bx + bw]  # invert: black ink on white

    side = max(bw, bh)
    pad = int(side * 0.25)
    canvas_size = side + 2 * pad
    canvas = np.full((canvas_size, canvas_size), 255, dtype=np.uint8)

    ox = (canvas_size - bw) // 2
    oy = (canvas_size - bh) // 2
    canvas[oy : oy + bh, ox : ox + bw] = content
    return canvas


# ── Pass 1: MNIST ──


def _prepare_mnist_input(gray_cell):
    """
    Prepare a 28x28 float32 input for MNIST.
    Inverts to white-on-black (MNIST convention), content-centered.
    """
    binary, bbox = _clean_binary(gray_cell)
    if bbox is None:
        return np.zeros((1, 1, 28, 28), dtype=np.float32)

    centered = _center_on_white(binary, bbox)
    resized = cv2.resize(centered, (28, 28), interpolation=cv2.INTER_AREA)
    # Invert: MNIST expects white digits on black background
    inverted = (255.0 - resized.astype(np.float32)) / 255.0
    return inverted.reshape(1, 1, 28, 28)


def _run_mnist_pass(warped_gray, cells):
    """
    Run MNIST on all cells. Returns list of (digit_or_None, confidence) tuples.
    digit is an int in {1,2,4,8} if confident, else None.
    """
    mnist = _get_mnist()
    input_name = mnist.get_inputs()[0].name
    output_name = mnist.get_outputs()[0].name

    results = []
    for cell in cells:
        gray_cell = _extract_cell_gray(warped_gray, cell)
        if gray_cell.size == 0:
            results.append((None, 0.0))
            continue

        inp = _prepare_mnist_input(gray_cell)
        logits = mnist.run([output_name], {input_name: inp})[0][0]

        # Softmax
        max_val = np.max(logits)
        exps = np.exp(logits - max_val)
        probs = exps / np.sum(exps)

        digit = int(np.argmax(probs))
        confidence = float(probs[digit])

        if digit in VALID_SINGLES and confidence >= MNIST_CONFIDENCE:
            results.append((digit, confidence))
        else:
            results.append((None, confidence))

    return results


# ── Pass 2: MFR ──


def _prepare_mfr_input(gray_cell):
    """Prepare a 384x384 RGB normalized input for the MFR encoder."""
    binary, bbox = _clean_binary(gray_cell)
    if bbox is None:
        centered = np.full_like(gray_cell, 255)
    else:
        centered = _center_on_white(binary, bbox)

    resized = cv2.resize(centered, (MFR_IMAGE_SIZE, MFR_IMAGE_SIZE), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)

    pixels = rgb.astype(np.float32) / 255.0
    pixels = (pixels - MFR_MEAN) / MFR_STD
    return pixels.transpose(2, 0, 1)  # HWC → CHW


def _greedy_decode(encoder_out, decoder, batch_size):
    """Greedy autoregressive decoding, batched across all cells."""
    input_ids = np.full((batch_size, 1), DECODER_START_TOKEN_ID, dtype=np.int64)
    finished = np.zeros(batch_size, dtype=bool)

    for _ in range(MAX_NEW_TOKENS):
        logits = decoder.run(
            ["logits"],
            {"input_ids": input_ids, "encoder_hidden_states": encoder_out},
        )[0]

        next_tokens = logits[:, -1, :].argmax(axis=-1).astype(np.int64)
        finished |= next_tokens == EOS_TOKEN_ID
        input_ids = np.concatenate([input_ids, next_tokens[:, None]], axis=1)

        if finished.all():
            break

    results = []
    for i in range(batch_size):
        ids = input_ids[i, 1:].tolist()
        if EOS_TOKEN_ID in ids:
            ids = ids[: ids.index(EOS_TOKEN_ID)]
        results.append(ids)
    return results


def _run_mfr_pass(warped_gray, cells, pending_indices):
    """
    Run MFR on a subset of cells (those MNIST couldn't classify).
    Falls back to thin-stroke heuristic for "1" if MFR also fails.
    Returns dict mapping cell index → CellValue dict.
    """
    if not pending_indices:
        return {}

    encoder, decoder, tokenizer = _get_mfr()

    # Build batch for pending cells only
    batch = np.zeros((len(pending_indices), 3, MFR_IMAGE_SIZE, MFR_IMAGE_SIZE), dtype=np.float32)
    for j, idx in enumerate(pending_indices):
        gray_cell = _extract_cell_gray(warped_gray, cells[idx])
        if gray_cell.size == 0:
            continue
        batch[j] = _prepare_mfr_input(gray_cell)

    # Encode + decode
    encoder_out = encoder.run(["last_hidden_state"], {"pixel_values": batch})[0]
    token_ids_list = _greedy_decode(encoder_out, decoder, len(pending_indices))

    # Parse results
    from cell_value import DEFAULT_CELL

    mfr_results = {}
    for j, idx in enumerate(pending_indices):
        latex = tokenizer.decode(token_ids_list[j], skip_special_tokens=True)
        cell_value = latex_to_cell_value(latex)
        r, c = cells[idx]["row"], cells[idx]["col"]
        confidence = 1.0 if cell_value != DEFAULT_CELL else 0.3
        print(f"  [{r}][{c}] mfr latex={repr(latex)} → {cell_value} conf={confidence}")
        mfr_results[idx] = (cell_value, confidence)

    return mfr_results


# ── Main entry point ──


def recognize_cells(warped, cells):
    """
    Recognize all cells in a warped grid image using two passes:

    1. MNIST pass: classify single digits {1, 2, 4, 8} with high confidence.
    2. MFR pass: for remaining cells, use the math formula recognizer to
       handle tied expressions (e.g. "1+2") and low-confidence digits.

    Returns (values, confidences) — both 4x4 lists.
    values: CellValue dicts.
    confidences: {"confidence": float, "source": "mnist"|"mfr"|"default"} dicts.
    """
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    # Pass 1: MNIST
    mnist_results = _run_mnist_pass(warped_gray, cells)

    pending = []
    for i, (digit, conf) in enumerate(mnist_results):
        r, c = cells[i]["row"], cells[i]["col"]
        if digit is not None:
            print(f"  [{r}][{c}] mnist={digit} conf={conf:.2f}")
        else:
            print(f"  [{r}][{c}] mnist=? conf={conf:.2f} → deferred to MFR")
            pending.append(i)

    # Pass 2: MFR for unresolved cells
    mfr_results = _run_mfr_pass(warped_gray, cells, pending)

    # Assemble final 4x4 grid
    values = [[] for _ in range(4)]
    confidences = [[] for _ in range(4)]
    for i, cell in enumerate(cells):
        if mnist_results[i][0] is not None:
            digit = mnist_results[i][0]
            cell_value = {"kind": "single", "dur": NUM_TO_DUR[digit]}
            cell_conf = {"confidence": mnist_results[i][1], "source": "mnist"}
        elif i in mfr_results:
            cell_value, mfr_conf = mfr_results[i]
            cell_conf = {"confidence": mfr_conf, "source": "mfr"}
        else:
            cell_value = {"kind": "single", "dur": "1/4"}  # fallback
            cell_conf = {"confidence": 0.0, "source": "default"}
        values[cell["row"]].append(cell_value)
        confidences[cell["row"]].append(cell_conf)

    return values, confidences
