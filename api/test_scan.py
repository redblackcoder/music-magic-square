"""
Integration tests for the scan pipeline using real test images.

Tests the full code path: image → grid detection → MFR cell recognition → CellValue.
Uses hand-drawn and printed grid photos from data/gridtestcases/.

Run:  python api/test_scan.py
"""

import os
import sys

import cv2

sys.path.insert(0, os.path.dirname(__file__))

from grid_detection import detect_grid
from cell_recognition import recognize_cells
from cell_value import cell_value_to_label

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "gridtestcases")

# ── Expected grids ──

# Expected values are based on the WARPED (perspective-corrected) grid orientation,
# which may differ from how the original photo appears visually.

GRID_W1 = [
    ["8", "4", "1", "1+2"],
    ["1+2", "1", "4", "8"],
    ["4", "8", "1+2", "1"],
    ["1", "1+2", "8", "4"],
]

GRID_W2 = [
    ["1+2", "8", "1", "4"],
    ["1", "4", "1+2", "8"],
    ["4", "1", "8", "1+2"],
    ["8", "1+2", "4", "1"],
]

EXPECTED = {
    "IMG_8765.jpeg": GRID_W1,
    "IMG_8766.jpeg": GRID_W1,
    "IMG_8767.jpeg": GRID_W1,
    "IMG_8768.jpeg": GRID_W2,
    "IMG_8769.jpeg": GRID_W2,
    "IMG_8770.jpeg": GRID_W2,  # fallback (no quad detected)
    "IMG_8771.jpeg": GRID_W2,
    "IMG_8772.jpeg": GRID_W2,
    "IMG_8773.jpeg": GRID_W2,
    "IMG_8774.jpeg": GRID_W1,
    "prod-scenario.jpg": GRID_W1,
}


def run_pipeline(image_path):
    """Run the full scan pipeline on an image file."""
    img = cv2.imread(image_path)
    assert img is not None, f"Failed to read {image_path}"

    warped, cells, quad_corners, grid_found = detect_grid(img)
    values, confidences = recognize_cells(warped, cells)
    return values, confidences, grid_found


def test_all_images():
    print(f"Testing {len(EXPECTED)} images from {DATA_DIR}\n")

    total_cells = 0
    correct_cells = 0

    for filename, expected_grid in sorted(EXPECTED.items()):
        path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(path):
            print(f"SKIP  {filename} (file not found)")
            continue

        values, confidences, grid_found = run_pipeline(path)
        recognized = [
            [cell_value_to_label(cell) for cell in row]
            for row in values
        ]

        cell_correct = 0
        mismatches = []
        for r in range(4):
            for c in range(4):
                total_cells += 1
                if recognized[r][c] == expected_grid[r][c]:
                    correct_cells += 1
                    cell_correct += 1
                else:
                    mismatches.append(
                        f"  [{r}][{c}] expected={expected_grid[r][c]} got={recognized[r][c]}"
                    )

        status = "PASS" if cell_correct == 16 else "FAIL"
        grid_tag = "grid-detected" if grid_found else "fallback"
        print(f"{status}  {filename} ({grid_tag}) {cell_correct}/16 cells correct")

        if mismatches:
            for m in mismatches:
                print(m)

        print(f"  Expected:    {expected_grid}")
        print(f"  Recognized:  {recognized}")
        print()

    # Summary
    print("=" * 60)
    passed_pct = 100 * correct_cells / total_cells if total_cells else 0
    print(f"Cells: {correct_cells}/{total_cells} correct ({passed_pct:.1f}%)")


if __name__ == "__main__":
    test_all_images()
