"""
Vercel serverless function: grid detection + cell recognition.

Receives a base64-encoded JPEG, detects a 4x4 grid, recognizes each cell's
math expression using the MFR model, and returns CellValue JSON.
"""

from http.server import BaseHTTPRequestHandler
import json
import base64
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
import cv2

from grid_detection import detect_grid
from cell_recognition import recognize_cells
from gemini_recognition import recognize_with_gemini


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

            # Decode base64 JPEG → numpy array
            img_bytes = base64.b64decode(image_b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                self._error(400, "Failed to decode image")
                return

            # Save debug copy locally (only when running locally, not on Vercel)
            debug_dir = os.path.join(os.path.dirname(__file__), "..", "temp")
            if os.path.isdir(debug_dir):
                ts = int(time.time())
                debug_path = os.path.join(debug_dir, f"scan_{ts}.jpg")
                with open(debug_path, "wb") as f:
                    f.write(img_bytes)
                print(f"[scan] saved debug image: {debug_path}")

            # Try Gemini LLM first — fall back to local models only on
            # API errors (rate limit, missing key, no credits, etc.)
            gemini_result = recognize_with_gemini(image_b64)

            if gemini_result is not None:
                values, confidences = gemini_result
                print("[scan] using Gemini result")
            else:
                print("[scan] Gemini unavailable, falling back to local models")
                warped, cells, quad_corners, grid_found = detect_grid(img)
                values, confidences = recognize_cells(warped, cells)

            self._json(200, {
                "values": values,
                "gridFound": True,
                "quadCorners": [],
                "confidences": confidences,
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._error(500, "Server is having issues right now, please try again.")

    def do_GET(self):
        """Diagnostic endpoint: list bundled files to debug includeFiles."""
        task_root = "/var/task"
        diag = {"status": "ok", "cwd": os.getcwd(), "__file__": __file__}
        for check_dir in ["public", "models", "models/mfr", "api"]:
            full = os.path.join(task_root, check_dir)
            try:
                entries = os.listdir(full)
                diag[check_dir] = entries
            except FileNotFoundError:
                diag[check_dir] = "NOT FOUND"
        # Also check specific files
        files_to_check = [
            os.path.join(task_root, "models", "mnist-12.onnx"),
            os.path.join(task_root, "models", "mfr", "encoder_model.onnx"),
            os.path.join(task_root, "models", "mfr", "decoder_model.onnx"),
            os.path.join(task_root, "models", "mfr", "tokenizer.json"),
        ]
        diag["file_exists"] = {f: os.path.isfile(f) for f in files_to_check}
        diag["file_sizes"] = {
            f: os.path.getsize(f) for f in files_to_check if os.path.isfile(f)
        }
        self._json(200, diag)

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, message):
        self._json(status, {"error": message})
