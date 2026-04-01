"""
OpenCV-based 4x4 grid detection.

Detects a quadrilateral grid in a photo, applies perspective correction,
and splits the result into 16 uniform cell regions.
"""

import numpy as np
import cv2

MAX_DETECT_DIM = 1024


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
    Detect a 4x4 grid in an image.

    Returns (warped, cells, quad_corners, grid_found):
        warped:       perspective-corrected image (numpy array, BGR)
        cells:        list of 16 dicts {x, y, w, h, row, col}
        quad_corners: [[x,y], ...] in original image coords (TL, TR, BR, BL)
        grid_found:   True if a real quadrilateral was detected
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
    """Fallback: bounding box of dark pixels when no quadrilateral is found."""
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
    """Split a region into 4x4 uniform cells."""
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
