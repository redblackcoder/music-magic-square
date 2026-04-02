"""
Generate all unique 4x4 magic squares summing to 16,
with cell values in 1-10, unique under rotation and reflection (D4 symmetry).

Usage:
  python generate_magic_squares.py                # no repeat constraint
  python generate_magic_squares.py --distinct     # all values distinct per row/col/diagonal
"""

import json
import itertools
import sys


TARGET = 16
MIN_VAL = 1
MAX_VAL = 10


def rotations_and_reflections(grid):
    """Yield all 8 D4 symmetries of a 4x4 grid (as tuples of tuples)."""
    def rotate90(g):
        return tuple(tuple(g[3 - c][r] for c in range(4)) for r in range(4))

    def reflect(g):
        return tuple(tuple(reversed(row)) for row in g)

    g = tuple(tuple(row) for row in grid)
    for _ in range(4):
        yield g
        yield reflect(g)
        g = rotate90(g)


def canonical(grid):
    """Return the lexicographically smallest D4 equivalent."""
    return min(rotations_and_reflections(grid))


def has_distinct_lines(grid):
    """Check that all rows, columns, and diagonals have 4 distinct values."""
    for r in range(4):
        if len(set(grid[r])) != 4:
            return False
    for c in range(4):
        if len({grid[r][c] for r in range(4)}) != 4:
            return False
    if len({grid[i][i] for i in range(4)}) != 4:
        return False
    if len({grid[i][3 - i] for i in range(4)}) != 4:
        return False
    return True


def generate(distinct=False):
    """Generate all unique magic squares."""
    # Find all 4-tuples from 1-10 that sum to 16
    combos = []
    for combo in itertools.product(range(MIN_VAL, MAX_VAL + 1), repeat=4):
        if sum(combo) == TARGET:
            combos.append(combo)

    if distinct:
        combos = [c for c in combos if len(set(c)) == 4]

    print(f"Found {len(combos)} row candidates (distinct={distinct})", file=sys.stderr)

    row_candidates = combos

    seen = set()
    results = []

    count = 0
    for r0 in row_candidates:
        for r1 in row_candidates:
            count += 1
            if count % 100000 == 0:
                print(f"  checked {count} row pairs, found {len(results)} so far...", file=sys.stderr)

            col_remainders = [TARGET - r0[j] - r1[j] for j in range(4)]

            feasible = True
            for rem in col_remainders:
                if rem < 2 or rem > 20:
                    feasible = False
                    break
            if not feasible:
                continue

            r2_ranges = []
            for j in range(4):
                rem = col_remainders[j]
                lo = max(MIN_VAL, rem - MAX_VAL)
                hi = min(MAX_VAL, rem - MIN_VAL)
                if lo > hi:
                    feasible = False
                    break
                r2_ranges.append(range(lo, hi + 1))

            if not feasible:
                continue

            for r2_0 in r2_ranges[0]:
                for r2_1 in r2_ranges[1]:
                    for r2_2 in r2_ranges[2]:
                        for r2_3 in r2_ranges[3]:
                            r2 = (r2_0, r2_1, r2_2, r2_3)

                            if sum(r2) != TARGET:
                                continue

                            if distinct and len(set(r2)) != 4:
                                continue

                            r3 = tuple(col_remainders[j] - r2[j] for j in range(4))

                            if any(v < MIN_VAL or v > MAX_VAL for v in r3):
                                continue

                            if sum(r3) != TARGET:
                                continue

                            if distinct and len(set(r3)) != 4:
                                continue

                            grid = (r0, r1, r2, r3)

                            # Check diagonals
                            d1 = grid[0][0] + grid[1][1] + grid[2][2] + grid[3][3]
                            d2 = grid[0][3] + grid[1][2] + grid[2][1] + grid[3][0]
                            if d1 != TARGET or d2 != TARGET:
                                continue

                            if distinct and not has_distinct_lines(grid):
                                continue

                            canon = canonical(grid)
                            if canon not in seen:
                                seen.add(canon)
                                results.append([list(row) for row in canon])

    print(f"Total unique magic squares: {len(results)}", file=sys.stderr)
    return results


if __name__ == "__main__":
    distinct = "--distinct" in sys.argv
    squares = generate(distinct=distinct)
    squares.sort()
    print(json.dumps(squares, indent=2))
