"""
Local dev server that wraps the Vercel serverless handler.
Run: python api/dev_server.py
Then start Vite separately: npm run dev
Vite proxies /api requests to this server (see vite.config.ts).
"""

import sys
import os
from http.server import HTTPServer

sys.path.insert(0, os.path.dirname(__file__))
from scan import handler

PORT = 8788

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), handler)
    print(f"[dev] API server listening on http://localhost:{PORT}")
    print(f"[dev] POST http://localhost:{PORT}/api/scan")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[dev] stopped")
