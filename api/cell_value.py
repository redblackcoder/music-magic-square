"""
CellValue constants and LaTeX → CellValue parsing.

Maps recognized math expressions (from the MFR model's LaTeX output)
to the music grid's CellValue format used by the frontend.
"""

import re

# Duration mapping: written number → musical note duration
NUM_TO_DUR = {1: "1/16", 2: "1/8", 4: "1/4", 8: "1/2"}
DUR_TO_NUM = {"1/16": "1", "1/8": "2", "1/4": "4", "1/2": "8"}

VALID_SINGLES = {1, 2, 4, 8}
VALID_PAIRS = {(1, 2), (1, 4), (1, 8), (2, 4), (2, 8), (4, 8)}

# Compound values (sum of sixteenths) → tied pair decomposition
# e.g. 3 sixteenths = 1+2 = tied(1/16, 1/8)
COMPOUND_TO_PAIR: dict[int, tuple[int, int]] = {
    3: (1, 2), 5: (1, 4), 6: (2, 4), 9: (1, 8), 10: (2, 8),
}

# Triple-tied compound value: 7 sixteenths = 4+2+1 = 1/4 + 1/8 + 1/16
COMPOUND_TO_TRIPLE: dict[int, tuple[int, int, int]] = {
    7: (4, 2, 1),
}

DEFAULT_CELL = {"kind": "single", "dur": "1/4"}


def latex_to_cell_value(latex: str) -> dict:
    """
    Parse a LaTeX string from the MFR model into a CellValue dict.

    Expected inputs: "1", "2", "4", "8", "1+2", "1 + 4", etc.
    The model may also produce LaTeX commands, braces, or other artifacts.
    We strip all LaTeX markup and try to extract numbers and + operators.
    """
    # Normalize common MFR misreadings of "+" before stripping
    normalized = latex.replace("\\div", "+").replace("\\times", "+").replace("\\neq", "+")
    # Strip LaTeX commands (e.g. \frac, \mathrm, \quad), braces, $, spaces
    clean = re.sub(r"\\[a-zA-Z]+", "", normalized)
    clean = clean.replace("{", "").replace("}", "").replace("$", "")
    clean = clean.replace(" ", "").replace("^", "").replace("_", "")

    # Single number (standard duration or compound value)
    m = re.match(r"^(\d+)$", clean)
    if m:
        n = int(m.group(1))
        if n in VALID_SINGLES and n in NUM_TO_DUR:
            return {"kind": "single", "dur": NUM_TO_DUR[n]}
        if n in COMPOUND_TO_TRIPLE:
            a, b, c = COMPOUND_TO_TRIPLE[n]
            return {"kind": "triple", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b], "third": NUM_TO_DUR[c]}
        if n in COMPOUND_TO_PAIR:
            a, b = COMPOUND_TO_PAIR[n]
            return {"kind": "tied", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b]}

    # Sum expression (e.g. "1+2", "4+8")
    m = re.match(r"^(\d+)\+(\d+)$", clean)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if a > b:
            a, b = b, a
        if (a, b) in VALID_PAIRS and a in NUM_TO_DUR and b in NUM_TO_DUR:
            return {"kind": "tied", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b]}

    # Fallback: try to find any valid number in the cleaned string
    digits = re.findall(r"\d+", clean)
    for d in digits:
        n = int(d)
        if n in VALID_SINGLES and n in NUM_TO_DUR:
            return {"kind": "single", "dur": NUM_TO_DUR[n]}
        if n in COMPOUND_TO_TRIPLE:
            a, b, c = COMPOUND_TO_TRIPLE[n]
            return {"kind": "triple", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b], "third": NUM_TO_DUR[c]}
        if n in COMPOUND_TO_PAIR:
            a, b = COMPOUND_TO_PAIR[n]
            return {"kind": "tied", "first": NUM_TO_DUR[a], "second": NUM_TO_DUR[b]}

    return DEFAULT_CELL


def cell_value_to_label(cv: dict) -> str:
    """Convert a CellValue dict back to a short label like '4', '1+2', or '4+2+1'."""
    if cv["kind"] == "single":
        return DUR_TO_NUM.get(cv["dur"], "?")
    if cv["kind"] == "triple":
        return f"{DUR_TO_NUM.get(cv['first'], '?')}+{DUR_TO_NUM.get(cv['second'], '?')}+{DUR_TO_NUM.get(cv['third'], '?')}"
    return f"{DUR_TO_NUM.get(cv['first'], '?')}+{DUR_TO_NUM.get(cv['second'], '?')}"
