"""
Gemini LLM-based grid recognition.

Sends the image to Gemini Flash to identify cell contents, returning
the same (values, confidences) format as the local model pipeline.
Falls back gracefully on rate limiting, missing API key, or other errors.
"""

import base64
import json
import os
import re

from cell_value import NUM_TO_DUR, VALID_SINGLES, VALID_PAIRS, DEFAULT_CELL


GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

SYSTEM_PROMPT = (
    'Provided with an image of a letter sized paper sheet or a portion of '
    'paper size paper sheet or picture with a paper sheet, identify the 4x4 '
    'grid from the sheet. Each of the 16 cells in the grid will have digits '
    '1 through 10, or two digit sum expression like "1 + 2", "3 + 4", etc. '
    'Return the content of the grid in form of a json response, with parsed '
    'content of each cell, in row wise order. Output should be like\n'
    '[[1, "1 + 2", 4, 8], ["1 + 2", 8, 1, 4], [4, 1, "1 + 2", 8], [3, 7, 10, "10 + 2"]]\n\n'
    'Return only the parsed json, nothing else.\n\n'
    'If image cannot be recognized or some cells cannot be recognised, '
    'set the corresponding value in the json response to 0 - indicating '
    'not detected or parsed.'
)


def _parse_cell(raw) -> dict:
    """Convert a single Gemini cell value into a CellValue dict."""
    text = str(raw).strip()

    # Single number
    m = re.match(r"^(\d+)$", text)
    if m:
        n = int(m.group(1))
        if n in VALID_SINGLES and n in NUM_TO_DUR:
            return {"kind": "single", "dur": NUM_TO_DUR[n]}

    # Sum expression: "1 + 2", "1+2", etc.
    clean = text.replace(" ", "")
    m = re.match(r"^(\d+)\+(\d+)$", clean)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if a > b:
            a, b = b, a
        if (a, b) in VALID_PAIRS and a in NUM_TO_DUR and b in NUM_TO_DUR:
            return {"kind": "tied", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b]}

    return DEFAULT_CELL


def recognize_with_gemini(image_b64: str):
    """
    Send image to Gemini and parse the grid response.

    Args:
        image_b64: base64-encoded JPEG image

    Returns:
        (values, confidences) in the same 4x4 format as local recognition,
        or None if the request fails for any reason.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[gemini] no GEMINI_API_KEY set, skipping")
        return None

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("[gemini] google-genai not installed, skipping")
        return None

    try:
        client = genai.Client(api_key=api_key)

        image_bytes = base64.b64decode(image_b64)

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    types.Part.from_text(text="Identify the 4x4 grid in this image."),
                ],
            ),
        ]

        config = types.GenerateContentConfig(
            max_output_tokens=200,
            thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
            response_mime_type="application/json",
            system_instruction=[types.Part.from_text(text=SYSTEM_PROMPT)],
        )

        # Collect streamed response
        full_text = ""
        for chunk in client.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        ):
            if chunk.text:
                full_text += chunk.text

        print(f"[gemini] raw response: {full_text[:500]}")

        # Parse JSON response
        grid = json.loads(full_text)

        if not isinstance(grid, list) or len(grid) != 4:
            print(f"[gemini] unexpected grid shape: {len(grid) if isinstance(grid, list) else type(grid)}")
            return None

        values = []
        confidences = []
        for r, row in enumerate(grid):
            if not isinstance(row, list) or len(row) != 4:
                print(f"[gemini] row {r} has {len(row) if isinstance(row, list) else type(row)} items")
                return None

            row_values = []
            row_confs = []
            for c, cell_raw in enumerate(row):
                cell_value = _parse_cell(cell_raw)
                is_default = (cell_value == DEFAULT_CELL and str(cell_raw).strip() != "4")
                is_zero = (str(cell_raw).strip() == "0")

                if is_zero or is_default:
                    conf = {"confidence": 0.3, "source": "gemini"}
                else:
                    conf = {"confidence": 1.0, "source": "gemini"}

                row_values.append(cell_value)
                row_confs.append(conf)
                print(f"  [{r}][{c}] gemini={repr(str(cell_raw))} → {cell_value} conf={conf['confidence']}")

            values.append(row_values)
            confidences.append(row_confs)

        return values, confidences

    except json.JSONDecodeError as e:
        print(f"[gemini] JSON parse error: {e}")
        return None
    except Exception as e:
        err_str = str(e).lower()
        if "rate" in err_str or "quota" in err_str or "429" in err_str:
            print(f"[gemini] rate limited: {e}")
        elif "credit" in err_str or "billing" in err_str or "403" in err_str:
            print(f"[gemini] billing/credit issue: {e}")
        else:
            print(f"[gemini] error: {e}")
        return None
