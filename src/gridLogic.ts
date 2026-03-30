import {
  type MusicGrid,
  type GridCell,
  type Bar,
  type CellValue,
  DEFAULT_PITCHES,
  DEFAULT_VALUES,
  getCellBeats,
} from './types';

/** Create the default 4x4 grid — a valid magic square */
export function createDefaultGrid(): MusicGrid {
  const grid: MusicGrid = [];
  for (let r = 0; r < 4; r++) {
    const row: GridCell[] = [];
    for (let c = 0; c < 4; c++) {
      row.push({
        row: r,
        col: c,
        value: DEFAULT_VALUES[r][c],
        pitch: DEFAULT_PITCHES[r][c],
      });
    }
    grid.push(row);
  }
  return grid;
}

/** Extract the 10 bars from the 4x4 grid */
export function extractBars(grid: MusicGrid): Bar[] {
  const bars: Bar[] = [];

  for (let r = 0; r < 4; r++) {
    bars.push({ label: `Row ${r + 1}`, cells: [grid[r][0], grid[r][1], grid[r][2], grid[r][3]] });
  }

  for (let c = 0; c < 4; c++) {
    bars.push({ label: `Col ${c + 1}`, cells: [grid[0][c], grid[1][c], grid[2][c], grid[3][c]] });
  }

  bars.push({
    label: 'Diag \\',
    cells: [grid[0][0], grid[1][1], grid[2][2], grid[3][3]],
  });

  bars.push({
    label: 'Diag /',
    cells: [grid[0][3], grid[1][2], grid[2][1], grid[3][0]],
  });

  return bars;
}

/** Update a single cell's value in the grid (immutable) */
export function updateCellValue(grid: MusicGrid, row: number, col: number, value: CellValue): MusicGrid {
  return grid.map((r, ri) =>
    r.map((cell, ci) => (ri === row && ci === col ? { ...cell, value } : cell))
  );
}

/** Validate that every row, column, and diagonal sums to 1 (one full bar in 4/4) */
export function validateMagicSquare(grid: MusicGrid): { valid: boolean; errors: string[] } {
  const bars = extractBars(grid);
  const errors: string[] = [];
  const EPS = 0.001;

  for (const bar of bars) {
    const sum = bar.cells.reduce((acc, cell) => acc + getCellBeats(cell.value), 0);
    if (Math.abs(sum - 1.0) > EPS) {
      const sixteenths = Math.round(sum * 16);
      errors.push(`${bar.label}: ${sixteenths}/16 (need 16/16)`);
    }
  }

  return { valid: errors.length === 0, errors };
}
