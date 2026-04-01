"""
Vercel serverless function: grid detection + cell recognition.

Receives a base64-encoded JPEG, detects a 4x4 grid, recognizes each cell's
math expression using the MFR model, and returns CellValue JSON.
"""

from http.server import BaseHTTPRequestHandler
import json
import base64

import numpy as np
import cv2

from grid_detection import detect_grid
from cell_recognition import recognize_cells


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

            # Grid detection
            warped, cells, quad_corners, grid_found = detect_grid(img)

            # Cell recognition
            values, confidences = recognize_cells(warped, cells)

            self._json(200, {
                "values": values,
                "gridFound": grid_found,
                "quadCorners": quad_corners,
                "confidences": confidences,
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
