#!/usr/bin/env python3
"""
Split a single photo containing many handwritten samples into individual images.

Two-step workflow:
  1. Detect samples and save numbered debug image:
     python split_samples.py photo.jpg --detect

  2. Assign labels using sample numbers from the debug image:
     python split_samples.py photo.jpg --assign 1-15:1 --assign 16-28:2

Detection results are saved to a JSON sidecar file so that sample numbers
are stable between step 1 and step 2, even across multiple photos.
"""

import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CLASSES_FILE = os.path.join(SCRIPT_DIR, "classes.json")
HANDWRITTEN_DIR = os.path.join(SCRIPT_DIR, "handwritten")

with open(CLASSES_FILE) as f:
    class_data = json.load(f)
    CLASSES = class_data["classes"]
    CLASS_INDEX = class_data["index"]


def detect_paper(gray):
    """
    Detect the white paper region via adaptive histogram thresholding
    and block-based brightness analysis.
    """
    h, w = gray.shape

    # Histogram-based threshold to separate paper from dark background
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    kernel = np.ones(15) / 15
    smooth = np.convolve(hist, kernel, mode='same')

    # Find valley between background and paper peaks
    valley_idx = int(np.argmin(smooth[60:200]) + 60)
    bright = gray > valley_idx

    # Block-based: a block is "paper" if >50% bright
    block_size = max(16, min(h, w) // 30)
    bh, bw = h // block_size, w // block_size

    paper_map = np.zeros((bh, bw), dtype=bool)
    for by in range(bh):
        for bx in range(bw):
            y1, y2 = by * block_size, min((by + 1) * block_size, h)
            x1, x2 = bx * block_size, min((bx + 1) * block_size, w)
            paper_map[by, bx] = bright[y1:y2, x1:x2].mean() > 0.5

    row_paper = paper_map.mean(axis=1)
    col_paper = paper_map.mean(axis=0)
    paper_rows = np.where(row_paper > 0.4)[0]
    paper_cols = np.where(col_paper > 0.4)[0]

    if len(paper_rows) == 0 or len(paper_cols) == 0:
        return 0, 0, w, h

    y1 = paper_rows[0] * block_size
    y2 = min((paper_rows[-1] + 1) * block_size, h)
    x1 = paper_cols[0] * block_size
    x2 = min((paper_cols[-1] + 1) * block_size, w)

    # Small inward margin
    my, mx = int((y2 - y1) * 0.02), int((x2 - x1) * 0.02)
    return x1 + mx, y1 + my, x2 - mx, y2 - my


def _merge_nearby_boxes(boxes, max_gap):
    """
    Merge boxes that are horizontally close and vertically overlapping.
    This groups parts of an expression (e.g., "1", "+", "2") into one box
    without merging separate samples that are further apart.
    """
    if not boxes:
        return boxes

    # Sort by x position
    boxes = sorted(boxes, key=lambda b: b[0])
    merged = [list(boxes[0])]

    for x, y, bw, bh in boxes[1:]:
        px, py, pw, ph = merged[-1]

        # Horizontal gap between this box and the previous merged box
        h_gap = x - (px + pw)

        # Vertical overlap: do they share vertical space?
        overlap_top = max(y, py)
        overlap_bot = min(y + bh, py + ph)
        has_v_overlap = overlap_bot > overlap_top

        if h_gap <= max_gap and has_v_overlap:
            # Merge: expand the previous box to include this one
            new_x = min(px, x)
            new_y = min(py, y)
            new_x2 = max(px + pw, x + bw)
            new_y2 = max(py + ph, y + bh)
            merged[-1] = [new_x, new_y, new_x2 - new_x, new_y2 - new_y]
        else:
            merged.append([x, y, bw, bh])

    return [tuple(b) for b in merged]


def find_samples(gray_paper, dilate=None, debug=False):
    """
    Find individual handwritten samples using OpenCV contour detection.

    1. Otsu threshold to get ink mask
    2. Light dilation to connect strokes within a character
    3. Find contours → bounding boxes
    4. Filter noise and thin lines (underlines)
    5. Merge horizontally close + vertically overlapping boxes (expression grouping)
    6. Sort reading order (top-to-bottom, left-to-right)

    dilate: horizontal merge gap in pixels (default: ~3.5% of paper width).
            Increase if expressions like "1+2" are getting split.
            Decrease if separate samples are merging together.

    Returns list of (x, y, w, h) bounding boxes in paper coordinates.
    """
    h, w = gray_paper.shape

    # Adaptive thresholding — handles uneven lighting (flash shadows, gradients).
    # Each pixel is compared to the mean of its local neighborhood.
    # block_size: large neighborhood (~5% of shorter dim) smooths over texture.
    block_size = max(31, int(min(h, w) * 0.05)) | 1  # ensure odd
    # C: how much darker than the local mean a pixel must be to count as ink.
    # 25 is high enough to ignore paper texture/grain, but catches pen strokes.
    adapt_C = 25
    binary = cv2.adaptiveThreshold(
        gray_paper, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, block_size, adapt_C,
    )

    # Morphological opening: erode then dilate to remove tiny noise specks
    # while preserving actual ink strokes.
    noise_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, noise_kernel)

    if debug:
        print(f"  Adaptive threshold: block_size={block_size}, C={adapt_C} (Gaussian)")
        mask_path = os.path.join(SCRIPT_DIR, "_debug_mask.png")
        cv2.imwrite(mask_path, binary)
        print(f"  Binary mask: {mask_path}")

    # Step 1: Dilation to connect strokes within characters/expressions.
    # If --dilate is provided, use it directly as the horizontal kernel width.
    # Otherwise use a light default (~0.5% of paper width).
    if dilate:
        kw = dilate
    else:
        kw = max(3, int(w * 0.005))
    kh = max(3, int(h * 0.003))
    dil_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
    dilated = cv2.dilate(binary, dil_kernel, iterations=1)

    if debug:
        print(f"  Dilation kernel: {kw}x{kh}")
        dil_path = os.path.join(SCRIPT_DIR, "_debug_dilated.png")
        cv2.imwrite(dil_path, dilated)
        print(f"  Dilated mask: {dil_path}")

    # Find contours from lightly dilated image
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = [cv2.boundingRect(c) for c in contours]

    if debug:
        print(f"  Raw contours: {len(boxes)}")

    # Filter tiny noise: at least 0.4% of paper in both dimensions
    min_bw = max(4, int(w * 0.004))
    min_bh = max(4, int(h * 0.004))
    boxes = [(x, y, bw, bh) for x, y, bw, bh in boxes
             if bw >= min_bw and bh >= min_bh]

    if debug:
        print(f"  After noise filter: {len(boxes)} (min {min_bw}x{min_bh})")

    # Filter thin lines (underlines, stray marks): aspect ratio 0.15 to 6
    boxes = [(x, y, bw, bh) for x, y, bw, bh in boxes
             if 0.15 < (bw / max(1, bh)) < 6.0]

    if debug:
        print(f"  After aspect filter: {len(boxes)}")

    # Step 2: Merge nearby boxes into expression groups.
    # Boxes that are horizontally close AND vertically overlapping
    # are parts of the same expression (e.g., "1", "+", "2" → "1+2").
    # merge_gap: max horizontal gap to merge across.
    merge_gap = dilate if dilate else max(5, int(w * 0.035))

    if debug:
        print(f"  Merge gap: {merge_gap}px")

    boxes = _merge_nearby_boxes(boxes, merge_gap)

    if debug:
        print(f"  After merging: {len(boxes)}")

    # Final size filter: remove anything huge (border artifacts)
    max_bw = int(w * 0.4)
    max_bh = int(h * 0.1)
    boxes = [(x, y, bw, bh) for x, y, bw, bh in boxes
             if bw < max_bw and bh < max_bh]

    if debug:
        print(f"  After max size filter: {len(boxes)}")

    # Sort in reading order: group into rows first, then sort left-to-right
    if not boxes:
        return [], []

    boxes = sorted(boxes, key=lambda b: b[1])  # sort by y

    # Compute a global row height estimate from all boxes
    all_heights = sorted([b[3] for b in boxes])
    # Use the median height as the reference for row grouping
    global_median_h = np.median(all_heights)

    # Group into rows: boxes whose vertical centers are within
    # 1x the median box height of the row's center.
    # Use the MEAN center of the current row (not just first box) for robustness.
    rows = []
    current_row = [boxes[0]]
    for box in boxes[1:]:
        row_mean_cy = np.mean([b[1] + b[3] / 2 for b in current_row])
        curr_cy = box[1] + box[3] / 2
        if abs(curr_cy - row_mean_cy) < global_median_h * 1.0:
            current_row.append(box)
        else:
            rows.append(sorted(current_row, key=lambda b: b[0]))
            current_row = [box]
    rows.append(sorted(current_row, key=lambda b: b[0]))

    # Build flat list and row assignment
    sorted_boxes = []
    box_rows = []  # parallel array: row number (1-indexed) for each box
    for ri, row in enumerate(rows, 1):
        for box in row:
            sorted_boxes.append(box)
            box_rows.append(ri)

    if debug:
        print(f"  Detected {len(rows)} rows, {len(sorted_boxes)} samples total")

    return sorted_boxes, box_rows


def save_debug_image(img, boxes, box_rows, paper_box, path):
    """Save annotated debug image with sample numbers and row colors."""
    debug_img = img.copy().convert("RGB")
    px1, py1, _, _ = paper_box
    arr = np.array(debug_img)

    # Paper boundary in blue
    bx1, by1, bx2, by2 = paper_box
    cv2.rectangle(arr, (bx1, by1), (bx2, by2), (0, 0, 255), 3)

    # Row colors cycle for visual distinction
    colors = [
        (255, 0, 0), (0, 180, 0), (0, 0, 255), (255, 128, 0),
        (180, 0, 180), (0, 180, 180), (128, 0, 0), (0, 128, 0),
    ]

    # Each sample: colored box + sample number (1-indexed)
    for i, (x, y, w, h) in enumerate(boxes):
        row = box_rows[i]
        color = colors[(row - 1) % len(colors)]
        ax, ay = x + px1, y + py1
        cv2.rectangle(arr, (ax, ay), (ax + w, ay + h), color, 2)
        # Show sample number prominently inside the box
        label = str(i + 1)
        font_scale = 0.5
        thickness = 2
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        # White background for readability
        cv2.rectangle(arr, (ax, max(0, ay - th - 6)), (ax + tw + 4, ay), (255, 255, 255), -1)
        cv2.putText(arr, label, (ax + 2, max(th + 2, ay - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)

    Image.fromarray(arr).save(path)
    print(f"  Debug image: {path}")


def classify_sample(crop, model_path=None):
    """Auto-classify using ONNX model. Returns (label, confidence) or (None, 0)."""
    onnx_path = os.path.join(os.path.dirname(SCRIPT_DIR), "public", "cell-recognizer.onnx")
    if model_path:
        onnx_path = model_path
    if not os.path.exists(onnx_path):
        return None, 0.0

    try:
        import onnxruntime as ort
        session = ort.InferenceSession(onnx_path)
        input_name = session.get_inputs()[0].name

        gray = crop.convert("L").resize((28, 28), Image.BILINEAR)
        arr = np.array(gray, dtype=np.float32) / 255.0
        arr = 1.0 - arr
        tensor = arr.reshape(1, 1, 28, 28).astype(np.float32)

        output = session.run(None, {input_name: tensor})[0]
        probs = np.exp(output[0]) / np.exp(output[0]).sum()
        pred_idx = int(np.argmax(probs))
        return CLASSES[pred_idx], float(probs[pred_idx])
    except Exception:
        return None, 0.0


def label_to_dirname(label):
    return label.replace("+", "_plus_")


def next_filename(directory):
    os.makedirs(directory, exist_ok=True)
    existing = [f for f in os.listdir(directory) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    return f"{len(existing):04d}.png"


def parse_assign(assign_args):
    """
    Parse --assign arguments like 'RANGE:LABEL' into a dict mapping
    sample index (0-based) → label.

    RANGE uses 1-indexed sample numbers from the debug image:
      '1-15:1'    → samples 1 through 15 get label '1'
      '42:4+8'    → sample 42 gets label '4+8'
      '16-28:2'   → samples 16 through 28 get label '2'

    Returns {index: label} dict.
    """
    assignments = {}
    if not assign_args:
        return assignments

    for spec in assign_args:
        if ':' not in spec:
            print(f"  Warning: invalid --assign format '{spec}', expected RANGE:LABEL")
            continue

        range_part, label = spec.rsplit(':', 1)

        # Normalize label
        if '+' in label:
            parts = label.split('+')
            if len(parts) == 2:
                try:
                    a, b = sorted(parts, key=int)
                    label = f"{a}+{b}"
                except ValueError:
                    pass

        if label not in CLASS_INDEX:
            print(f"  Warning: unknown class '{label}' in --assign '{spec}'")
            continue

        # Parse range (1-indexed in user input → 0-indexed internally)
        if '-' in range_part:
            s, e = range_part.split('-', 1)
            for idx in range(int(s) - 1, int(e)):
                assignments[idx] = label
        else:
            assignments[int(range_part) - 1] = label

    return assignments


def detection_id(image_path):
    """Stable ID derived from the image filename (without extension)."""
    return os.path.splitext(os.path.basename(image_path))[0]


def save_detection(det_id, image_path, paper_box, boxes, box_rows):
    """Save detection results to a JSON sidecar file."""
    data = {
        "image": os.path.abspath(image_path),
        "paper_box": [int(x) for x in paper_box],
        "boxes": [[int(v) for v in b] for b in boxes],
        "box_rows": [int(r) for r in box_rows],
    }
    path = os.path.join(SCRIPT_DIR, f"_detect_{det_id}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return path


def load_detection(det_id):
    """Load detection results from a previously saved JSON sidecar."""
    path = os.path.join(SCRIPT_DIR, f"_detect_{det_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        data = json.load(f)
    data["boxes"] = [tuple(b) for b in data["boxes"]]
    data["paper_box"] = tuple(data["paper_box"])
    return data


def main():
    parser = argparse.ArgumentParser(
        description="Split photo of handwritten samples into class folders",
        epilog="Workflow:\n"
               "  # Step 1: Detect samples and get a numbered debug image:\n"
               "  %(prog)s photo.jpg --detect\n\n"
               "  # Step 2: Assign labels using sample numbers from the debug image:\n"
               "  %(prog)s photo.jpg --assign 1-15:1 --assign 16-28:2 --assign 29-42:4\n\n"
               "  # The --assign step loads saved detection results, so sample numbers\n"
               "  # are guaranteed to match the debug image.\n"
               "  # Samples without --assign are prompted interactively.\n"
               "  # Use --output testing to save to testing/ instead of handwritten/.\n",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("image", help="Path to the photo")
    parser.add_argument("--output", type=str, default=HANDWRITTEN_DIR, help="Output directory")
    parser.add_argument("--detect", action="store_true",
                        help="Step 1: detect samples, save numbered debug image + detection JSON. "
                             "Does not save any crops.")
    parser.add_argument("--assign", action="append", metavar="RANGE:LABEL",
                        help="Step 2: assign LABEL to samples by number (from --detect image). "
                             "Loads saved detection so numbers match. "
                             "e.g. --assign 1-15:1 --assign 16-28:2 --assign 50-73:1+2")
    parser.add_argument("--dilate", type=int,
                        help="Horizontal dilation in pixels (default: ~2.5%% of paper width). "
                             "Increase if expressions like '1+2' are split. "
                             "Decrease if separate samples merge.")
    parser.add_argument("--model", type=str, help="ONNX model path for auto-classification")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"Image not found: {args.image}")
        sys.exit(1)

    img = Image.open(args.image)
    det_id = detection_id(args.image)

    # ── Step 1: --detect ──
    if args.detect:
        print(f"Loaded {args.image} ({img.size[0]}x{img.size[1]})")

        gray = np.array(img.convert("L"))
        px1, py1, px2, py2 = detect_paper(gray)
        paper_gray = gray[py1:py2, px1:px2]
        print(f"  Paper: ({px1},{py1})-({px2},{py2}) = {px2-px1}x{py2-py1}")

        boxes, box_rows = find_samples(paper_gray, dilate=args.dilate, debug=True)

        if not boxes:
            print("No samples found.")
            sys.exit(1)

        # Save detection results
        paper_box = (px1, py1, px2, py2)
        json_path = save_detection(det_id, args.image, paper_box, boxes, box_rows)

        # Save debug image
        debug_path = os.path.join(SCRIPT_DIR, f"_debug_{det_id}.png")
        save_debug_image(img, boxes, box_rows, paper_box, debug_path)

        # Print summary
        num_rows = max(box_rows)
        print(f"\nFound {len(boxes)} samples in {num_rows} rows:")
        for r in range(1, num_rows + 1):
            count = sum(1 for br in box_rows if br == r)
            first_idx = next(i for i, br in enumerate(box_rows) if br == r)
            last_idx = len(box_rows) - 1 - next(i for i, br in enumerate(reversed(box_rows)) if br == r)
            print(f"  Row {r:2d}: {count:3d} samples  (#{first_idx + 1}-{last_idx + 1})")

        print(f"\nDetection saved: {json_path}")
        print(f"Debug image:     {debug_path}")
        print(f"\nNext step — assign labels using sample numbers from the debug image:")
        print(f"  python split_samples.py {args.image} --assign 1-15:1 --assign 16-28:2 ...")
        return

    # ── Step 2: --assign (loads saved detection) ──
    if args.assign:
        detection = load_detection(det_id)
        if detection is None:
            print(f"No saved detection for '{det_id}'. Run --detect first:")
            print(f"  python split_samples.py {args.image} --detect")
            sys.exit(1)

        boxes = detection["boxes"]
        box_rows = detection["box_rows"]
        px1, py1, px2, py2 = detection["paper_box"]

        print(f"Loaded detection: {len(boxes)} samples from _detect_{det_id}.json")

        assignments = parse_assign(args.assign)
        assigned_count = len(assignments)
        unassigned = len(boxes) - assigned_count
        print(f"Assignments: {assigned_count} samples labeled")
        if unassigned > 0:
            print(f"  ({unassigned} unassigned samples will be skipped)")

        saved = 0
        skipped = 0

        for i in range(len(boxes)):
            x, y, w, h = boxes[i]
            pad = 4
            cx1 = max(0, x - pad) + px1
            cy1 = max(0, y - pad) + py1
            cx2 = min(px2, x + w + pad + px1)
            cy2 = min(py2, y + h + pad + py1)
            crop = img.crop((cx1, cy1, cx2, cy2))

            if i not in assignments:
                skipped += 1
                continue

            label = assignments[i]
            dirname = label_to_dirname(label)
            class_dir = os.path.join(args.output, dirname)
            fname = next_filename(class_dir)
            crop.save(os.path.join(class_dir, fname))
            saved += 1

        print(f"\nDone: {saved} saved, {skipped} skipped")
        return

    # ── No flags: interactive mode ──
    print(f"Loaded {args.image} ({img.size[0]}x{img.size[1]})")

    gray = np.array(img.convert("L"))
    px1, py1, px2, py2 = detect_paper(gray)
    paper_gray = gray[py1:py2, px1:px2]
    print(f"  Paper: ({px1},{py1})-({px2},{py2}) = {px2-px1}x{py2-py1}")

    boxes, box_rows = find_samples(paper_gray, dilate=args.dilate, debug=False)

    if not boxes:
        print("No samples found.")
        sys.exit(1)

    print(f"Found {len(boxes)} samples")

    saved = 0
    skipped = 0

    for i in range(len(boxes)):
        x, y, w, h = boxes[i]
        pad = 4
        cx1 = max(0, x - pad) + px1
        cy1 = max(0, y - pad) + py1
        cx2 = min(px2, x + w + pad + px1)
        cy2 = min(py2, y + h + pad + py1)
        crop = img.crop((cx1, cy1, cx2, cy2))

        pred_label, confidence = classify_sample(crop, args.model)
        preview_path = os.path.join(SCRIPT_DIR, f"_preview_{i}.png")
        crop.save(preview_path)

        hint = f" (model: {pred_label} {confidence:.0%})" if pred_label else ""
        prompt = (
            f"\nSample #{i + 1}/{len(boxes)} (row {box_rows[i]}){hint}"
            f"\n  Preview: {preview_path}"
            f"\n  Label (e.g. '4', '2+8'), [s]kip, [q]uit: "
        )
        response = input(prompt).strip()

        if os.path.exists(preview_path):
            os.remove(preview_path)

        if response.lower() == "q":
            break
        elif response.lower() == "s" or response == "":
            skipped += 1
            continue

        label = response
        if "+" in label:
            parts = label.split("+")
            if len(parts) == 2:
                try:
                    a, b = sorted(parts, key=int)
                    label = f"{a}+{b}"
                except ValueError:
                    pass
        if label not in CLASS_INDEX:
            print(f"  Unknown class '{label}', skipping.")
            skipped += 1
            continue

        dirname = label_to_dirname(label)
        class_dir = os.path.join(args.output, dirname)
        fname = next_filename(class_dir)
        crop.save(os.path.join(class_dir, fname))
        saved += 1

    print(f"\nDone: {saved} saved, {skipped} skipped")


if __name__ == "__main__":
    main()
