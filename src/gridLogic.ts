import { type MusicGrid, type GridCell, type Bar, type NoteType, DEFAULT_PITCHES } from './types';

/** Create a default 4x4 grid filled with quarter notes */
export function createDefaultGrid(): MusicGrid {
  const grid: MusicGrid = [];
  for (let r = 0; r < 4; r++) {
    const row: GridCell[] = [];
    for (let c = 0; c < 4; c++) {
      row.push({ row: r, col: c, note: 'quarter', pitch: DEFAULT_PITCHES[r][c] });
    }
    grid.push(row);
  }
  return grid;
}

/** Extract the 10 bars from the 4x4 grid:
 *  Bars 1-4: rows, Bars 5-8: columns, Bar 9: main diagonal, Bar 10: anti-diagonal */
export function extractBars(grid: MusicGrid): Bar[] {
  const bars: Bar[] = [];

  // Bars 1-4: rows
  for (let r = 0; r < 4; r++) {
    bars.push({ label: `Row ${r + 1}`, cells: [grid[r][0], grid[r][1], grid[r][2], grid[r][3]] });
  }

  // Bars 5-8: columns
  for (let c = 0; c < 4; c++) {
    bars.push({ label: `Col ${c + 1}`, cells: [grid[0][c], grid[1][c], grid[2][c], grid[3][c]] });
  }

  // Bar 9: main diagonal (0,0) -> (3,3)
  bars.push({
    label: 'Diag \\',
    cells: [grid[0][0], grid[1][1], grid[2][2], grid[3][3]],
  });

  // Bar 10: anti-diagonal (0,3) -> (3,0)
  bars.push({
    label: 'Diag /',
    cells: [grid[0][3], grid[1][2], grid[2][1], grid[3][0]],
  });

  return bars;
}

/** Update a single cell's note type in the grid (immutable) */
export function updateCellNote(grid: MusicGrid, row: number, col: number, note: NoteType): MusicGrid {
  return grid.map((r, ri) =>
    r.map((cell, ci) => (ri === row && ci === col ? { ...cell, note } : cell))
  );
}
