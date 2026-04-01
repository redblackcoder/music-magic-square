"""
Serverless function for grid detection + cell recognition.

Receives a base64-encoded JPEG, detects a 4×4 grid using OpenCV,
recognizes each cell with an ONNX model, and returns the values as JSON.
"""

from http.server import BaseHTTPRequestHandler
import json
import base64
import os
import re

import numpy as np
import cv2
import onnxruntime as ort

# ── Constants ──

MAX_DETECT_DIM = 1024
CONFIDENCE_THRESHOLD = 0.5
NUM_TO_DUR = {1: "1/16", 2: "1/8", 4: "1/4", 8: "1/2"}
VALID_SINGLES = {1, 2, 4, 8}
VALID_PAIRS = {(1, 2), (1, 4), (1, 8), (2, 4), (2, 8), (4, 8)}
DEFAULT_CELL = {"kind": "single", "dur": "1/4"}

# ── Module-level init (cached across warm invocations) ──

PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
CLASSES_PATH = os.path.join(PROJECT_ROOT, "model-training", "classes.json")

_session = None
_labels = None


def _get_session():
    global _session, _labels
    if _session is not None:
        return _session, _labels

    with open(CLASSES_PATH) as f:
        _labels = json.load(f)["classes"]

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1

    primary = os.path.join(PUBLIC_DIR, "cell-recognizer.onnx")
    fallback = os.path.join(PUBLIC_DIR, "mnist-12.onnx")

    try:
        _session = ort.InferenceSession(primary, opts)
        print(f"[scan] loaded 65-class model: {primary}")
    except Exception as e:
        print(f"[scan] 65-class model failed ({e}), falling back to MNIST")
        _session = ort.InferenceSession(fallback, opts)
        _labels = [str(i) for i in range(10)]
        print(f"[scan] loaded MNIST model: {fallback}")

    return _session, _labels


# ── Grid detection ──


def order_corners(pts):
    """Order 4 points as TL, TR, BR, BL."""
    sums = [p[0] + p[1] for p in pts]
    diffs = [p[1] - p[0] for p in pts]
    tl = pts[sums.index(min(sums))]
    br = pts[sums.index(max(sums))]
    tr = pts[diffs.index(min(diffs))]
    bl = pts[diffs.index(max(diffs))]
    return [tl, tr, br, bl]


def detect_grid(img):
    """
    Detect a 4×4 grid. Returns (warped, cells, quad_corners, grid_found).
    warped: perspective-corrected image (numpy array)
    cells: list of 16 dicts {x, y, w, h, row, col}
    quad_corners: [[x,y], ...] in original image coords
    grid_found: True if a real quadrilateral was detected
    """
    h, w = img.shape[:2]
    max_dim = max(w, h)
    scale = MAX_DETECT_DIM / max_dim if max_dim > MAX_DETECT_DIM else 1.0

    if scale < 1:
        small = cv2.resize(img, (round(w * scale), round(h * scale)))
    else:
        small = img.copy()

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    small_area = small.shape[0] * small.shape[1]
    best_quad = None
    best_area = 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < small_area * 0.05:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx) and area > best_area:
            best_area = area
            best_quad = []
            for pt in approx:
                best_quad.append([
                    round(pt[0][0] / scale),
                    round(pt[0][1] / scale),
                ])

    if best_quad is None:
        return _fallback_detection(img)

    ordered = order_corners(best_quad)
    tl, tr, br, bl = ordered

    width_top = np.hypot(tr[0] - tl[0], tr[1] - tl[1])
    width_bot = np.hypot(br[0] - bl[0], br[1] - bl[1])
    height_left = np.hypot(bl[0] - tl[0], bl[1] - tl[1])
    height_right = np.hypot(br[0] - tr[0], br[1] - tr[1])

    out_w = round(max(width_top, width_bot))
    out_h = round(max(height_left, height_right))

    src_pts = np.array(ordered, dtype=np.float32)
    dst_pts = np.array([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped = cv2.warpPerspective(img, M, (out_w, out_h))

    cells = _split_cells(out_w, out_h)
    return warped, cells, ordered, True


def _fallback_detection(img):
    """Fallback: bounding box of dark pixels."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    mask = gray < 128
    dark_count = np.count_nonzero(mask)

    if dark_count < 100:
        size = round(min(w, h) * 0.8)
        bx, by = round((w - size) / 2), round((h - size) / 2)
        bw, bh = size, size
    else:
        ys, xs = np.where(mask)
        pad = 5
        bx = max(0, int(xs.min()) - pad)
        by = max(0, int(ys.min()) - pad)
        bw = min(w, int(xs.max()) + pad) - bx
        bh = min(h, int(ys.max()) + pad) - by

    warped = img[by : by + bh, bx : bx + bw].copy()
    cells = _split_cells(bw, bh)
    corners = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]]
    return warped, cells, corners, False


def _split_cells(w, h):
    """Split into 4×4 uniform cells."""
    cell_w, cell_h = w / 4, h / 4
    cells = []
    for r in range(4):
        for c in range(4):
            cells.append({
                "x": round(c * cell_w),
                "y": round(r * cell_h),
                "w": round(cell_w),
                "h": round(cell_h),
                "row": r,
                "col": c,
            })
    return cells


# ── Cell recognition ──


def prepare_cell(warped_gray, x, y, w, h):
    """Extract a cell, inset 10%, resize to 28×28, invert to MNIST convention."""
    inset = 0.1
    cx = int(x + w * inset)
    cy = int(y + h * inset)
    cw = int(w * (1 - 2 * inset))
    ch = int(h * (1 - 2 * inset))

    cell = warped_gray[cy : cy + ch, cx : cx + cw]
    if cell.size == 0:
        return np.zeros((28, 28), dtype=np.float32)
    resized = cv2.resize(cell, (28, 28), interpolation=cv2.INTER_AREA)
    inverted = (255.0 - resized.astype(np.float32)) / 255.0
    return inverted


def label_to_cell_value(label, confidence):
    """Convert a class label to a CellValue dict."""
    if confidence < CONFIDENCE_THRESHOLD:
        return DEFAULT_CELL

    clean = label.strip().replace("o", "0").replace("O", "0")

    # Single digit
    m = re.match(r"^(\d+)$", clean)
    if m:
        n = int(m.group(1))
        if n in VALID_SINGLES and n in NUM_TO_DUR:
            return {"kind": "single", "dur": NUM_TO_DUR[n]}

    # Tied pair
    m = re.match(r"^(\d+)\+(\d+)$", clean)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if a > b:
            a, b = b, a
        if (a, b) in VALID_PAIRS and a in NUM_TO_DUR and b in NUM_TO_DUR:
            return {"kind": "tied", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b]}

    return DEFAULT_CELL


def recognize_cells(warped, cells, session, labels):
    """Recognize all 16 cells in a single batched ONNX call."""
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    batch = np.zeros((len(cells), 1, 28, 28), dtype=np.float32)
    for i, cell in enumerate(cells):
        batch[i, 0] = prepare_cell(warped_gray, cell["x"], cell["y"], cell["w"], cell["h"])

    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    logits = session.run([output_name], {input_name: batch})[0]

    values = [[] for _ in range(4)]
    for i, cell in enumerate(cells):
        row_logits = logits[i]
        max_val = np.max(row_logits)
        exps = np.exp(row_logits - max_val)
        probs = exps / np.sum(exps)

        class_idx = int(np.argmax(probs))
        confidence = float(probs[class_idx])
        label = labels[class_idx] if class_idx < len(labels) else str(class_idx)

        cell_value = label_to_cell_value(label, confidence)
        values[cell["row"]].append(cell_value)

    return values


# ── HTTP handler ──


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            image_b64 = data.get("image", "")
            if not image_b64:
                self._error(400, "Missing 'image' field")
                return

            # Decode base64 JPEG
            img_bytes = base64.b64decode(image_b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                self._error(400, "Failed to decode image")
                return

            # Grid detection
            warped, cells, quad_corners, grid_found = detect_grid(img)

            # Cell recognition
            session, labels = _get_session()
            values = recognize_cells(warped, cells, session, labels)

            self._json(200, {
                "values": values,
                "gridFound": grid_found,
                "quadCorners": quad_corners,
            })

        except Exception as e:
            print(f"[scan] error: {e}")
            self._error(500, str(e))

    def do_GET(self):
        self._json(200, {"status": "ok"})

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, message):
        self._json(status, {"error": message})
