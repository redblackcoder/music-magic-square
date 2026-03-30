import {
  type MusicGrid,
  type CellValue,
  CELL_OPTIONS,
  DUR_SYMBOL,
  PITCH_NAMES,
  formatBeats,
} from '../types';

interface GridEditorProps {
  grid: MusicGrid;
  onCellChange: (row: number, col: number, value: CellValue) => void;
  activeBar: number;
  activeNote: number;
}

function getBarCells(barIndex: number): [number, number][] {
  if (barIndex < 0) return [];
  if (barIndex < 4) return [0, 1, 2, 3].map((c) => [barIndex, c]);
  if (barIndex < 8) {
    const col = barIndex - 4;
    return [0, 1, 2, 3].map((r) => [r, col]);
  }
  if (barIndex === 8) return [[0, 0], [1, 1], [2, 2], [3, 3]];
  return [[0, 3], [1, 2], [2, 1], [3, 0]];
}

function cellValuesEqual(a: CellValue, b: CellValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'single' && b.kind === 'single') return a.dur === b.dur;
  if (a.kind === 'tied' && b.kind === 'tied') return a.first === b.first && a.second === b.second;
  return false;
}

/** Render the note symbol(s) for a cell value */
function CellSymbol({ value }: { value: CellValue }) {
  if (value.kind === 'single') {
    const sym = DUR_SYMBOL[value.dur];
    return (
      <span
        className="cell-note bravura"
        style={{ fontSize: sym.size, transform: `translateY(${sym.dy}px)` }}
      >
        {sym.char}
      </span>
    );
  }

  // Tied notes: show both symbols with a tie arc
  const sym1 = DUR_SYMBOL[value.first];
  const sym2 = DUR_SYMBOL[value.second];
  return (
    <span className="cell-tied">
      <span
        className="cell-note bravura"
        style={{ fontSize: sym1.size * 0.7, transform: `translateY(${sym1.dy * 0.7}px)` }}
      >
        {sym1.char}
      </span>
      <svg className="tie-arc" viewBox="0 0 20 8" width="16" height="6">
        <path d="M1 6 Q10 0 19 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span
        className="cell-note bravura"
        style={{ fontSize: sym2.size * 0.7, transform: `translateY(${sym2.dy * 0.7}px)` }}
      >
        {sym2.char}
      </span>
    </span>
  );
}

export default function GridEditor({ grid, onCellChange, activeBar, activeNote }: GridEditorProps) {
  const activeCells = getBarCells(activeBar);

  function cycleValue(row: number, col: number) {
    const current = grid[row][col].value;
    const idx = CELL_OPTIONS.findIndex((o) => cellValuesEqual(o, current));
    const next = CELL_OPTIONS[(idx + 1) % CELL_OPTIONS.length];
    onCellChange(row, col, next);
  }

  function isActive(r: number, c: number): boolean {
    return activeCells.some(([ar, ac]) => ar === r && ac === c);
  }

  function isPlaying(r: number, c: number): boolean {
    if (activeBar < 0 || activeNote < 0) return false;
    const cells = getBarCells(activeBar);
    if (activeNote >= cells.length) return false;
    const [pr, pc] = cells[activeNote];
    return pr === r && pc === c;
  }

  return (
    <div className="grid-editor">
      <div className="grid-4x4">
        {grid.map((row, ri) =>
          row.map((cell, ci) => (
            <button
              key={`${ri}-${ci}`}
              className={`grid-cell ${isActive(ri, ci) ? 'active' : ''} ${isPlaying(ri, ci) ? 'playing' : ''}`}
              onClick={() => cycleValue(ri, ci)}
              title={`${PITCH_NAMES[cell.pitch]} - ${formatBeats(cell.value)} (tap to change)`}
            >
              <CellSymbol value={cell.value} />
              <span className="cell-beats">{formatBeats(cell.value)}</span>
              <span className="cell-pitch">{PITCH_NAMES[cell.pitch]}</span>
            </button>
          ))
        )}
      </div>
      <p className="grid-hint">Tap a cell to cycle note durations. Each line must sum to 1 bar.</p>
    </div>
  );
}
