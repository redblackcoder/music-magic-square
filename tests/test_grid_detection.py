#!/usr/bin/env python3
"""
Test grid detection on sample images using OpenCV.

Same algorithm as src/gridDetection.ts (Canny → contours → perspective transform).
Generates overlay images for visual verification.

Usage:
    cd model-training && uv run python ../tests/test_grid_detection.py
"""

import os
import sys
import cv2
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
TESTCASES_DIR = os.path.join(PROJECT_DIR, "data", "gridtestcases")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "fixtures", "grids")


def order_corners(pts):
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left."""
    pts = np.array(pts, dtype=np.float32)
    sums = pts.sum(axis=1)
    diffs = np.diff(pts, axis=1).flatten()

    tl = pts[np.argmin(sums)]
    br = pts[np.argmax(sums)]
    tr = pts[np.argmin(diffs)]
    bl = pts[np.argmax(diffs)]

    return np.array([tl, tr, br, bl], dtype=np.float32)


def detect_grid(image):
    """
    Detect a 4x4 grid using Canny edge detection + contour finding.
    Returns (ordered_corners, success) where corners are in original image coords.
    """
    h, w = image.shape[:2]

    # Downscale for fast processing
    max_dim = 1024
    scale = min(max_dim / max(w, h), 1.0)
    if scale < 1:
        small = cv2.resize(image, (int(w * scale), int(h * scale)))
    else:
        small = image.copy()

    # Grayscale + blur + Canny
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # Dilate to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_quad = None
    best_area = 0
    small_area = small.shape[0] * small.shape[1]

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < small_area * 0.05:
            continue

        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        if len(approx) == 4 and cv2.isContourConvex(approx) and area > best_area:
            best_area = area
            # Scale back to original resolution
            best_quad = (approx.reshape(4, 2) / scale).astype(np.float32)

    if best_quad is None:
        return None, False

    ordered = order_corners(best_quad)
    return ordered, True


def perspective_transform(image, corners):
    """Apply perspective transform to extract the grid region."""
    tl, tr, br, bl = corners

    # Output dimensions
    width_top = np.linalg.norm(tr - tl)
    width_bot = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)

    out_w = int(max(width_top, width_bot))
    out_h = int(max(height_left, height_right))

    dst = np.array([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(corners, dst)
    warped = cv2.warpPerspective(image, M, (out_w, out_h))

    return warped


def generate_overlays(image_path, output_dir):
    """Run detection and generate overlay images."""
    fname = os.path.splitext(os.path.basename(image_path))[0]
    image = cv2.imread(image_path)
    if image is None:
        print(f"  SKIP: cannot read {image_path}")
        return False

    h, w = image.shape[:2]
    corners, found = detect_grid(image)

    if not found:
        print(f"  FAIL: no quadrilateral found in {fname}")
        # Save debug edge image
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        cv2.imwrite(os.path.join(output_dir, f"{fname}_edges.png"), edges)
        return False

    # --- Overlay 1: quadrilateral on original image ---
    quad_img = image.copy()
    pts = corners.astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(quad_img, [pts], True, (0, 255, 0), max(3, w // 400))

    labels = ["TL", "TR", "BR", "BL"]
    font_scale = max(0.8, w / 2000)
    for i, (label, pt) in enumerate(zip(labels, corners)):
        x, y = int(pt[0]), int(pt[1])
        cv2.putText(quad_img, label, (x + 10, y - 10),
                     cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), 2)

    cv2.imwrite(os.path.join(output_dir, f"{fname}_quad.png"), quad_img)

    # --- Perspective transform ---
    warped = perspective_transform(image, corners)
    wh, ww = warped.shape[:2]

    # --- Overlay 2: numbered cells on warped image ---
    cell_w = ww / 4
    cell_h = wh / 4
    inset = 0.1
    overlay = warped.copy()
    font_scale_w = max(0.5, cell_h / 200)

    for r in range(4):
        for c in range(4):
            num = r * 4 + c + 1
            x = int(c * cell_w)
            y = int(r * cell_h)
            cw = int(cell_w)
            ch = int(cell_h)

            # Full cell box (red)
            cv2.rectangle(overlay, (x, y), (x + cw, y + ch), (0, 0, 255), max(1, ww // 800))

            # Inset box (cyan, dashed approximation)
            ix = int(x + cw * inset)
            iy = int(y + ch * inset)
            iw = int(cw * (1 - 2 * inset))
            ih = int(ch * (1 - 2 * inset))
            cv2.rectangle(overlay, (ix, iy), (ix + iw, iy + ih), (255, 255, 0), 1)

            # Number label
            label_x = int(x + cell_w / 2 - 10 * font_scale_w)
            label_y = int(y + cell_h / 2 + 10 * font_scale_w)
            # Background
            (tw, th), _ = cv2.getTextSize(str(num), cv2.FONT_HERSHEY_SIMPLEX, font_scale_w, 2)
            cx = int(x + cell_w / 2)
            cy = int(y + cell_h / 2)
            cv2.rectangle(overlay,
                          (cx - tw // 2 - 4, cy - th // 2 - 4),
                          (cx + tw // 2 + 4, cy + th // 2 + 4),
                          (0, 0, 0), -1)
            cv2.putText(overlay, str(num),
                        (cx - tw // 2, cy + th // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale_w, (255, 255, 255), 2)

    cv2.imwrite(os.path.join(output_dir, f"{fname}_overlay.png"), overlay)

    print(f"  OK: {fname} → quad + overlay")
    return True


def main():
    if not os.path.isdir(TESTCASES_DIR):
        print(f"No test cases directory: {TESTCASES_DIR}")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    files = sorted(f for f in os.listdir(TESTCASES_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    if not files:
        print(f"No images in {TESTCASES_DIR}")
        sys.exit(1)

    print(f"Testing grid detection on {len(files)} images...\n")

    passed = 0
    for f in files:
        path = os.path.join(TESTCASES_DIR, f)
        if generate_overlays(path, OUTPUT_DIR):
            passed += 1

    print(f"\n{passed}/{len(files)} images detected successfully")
    print(f"Overlays saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
