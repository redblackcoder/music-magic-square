import { useRef, useCallback } from 'react';
import {
  type MusicGrid,
  type CellValue,
  CELL_OPTIONS,
  DUR_SYMBOL,
  REST_SYMBOL,
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
  if (a.kind === 'rest' && b.kind === 'rest') return a.dur === b.dur;
  return false;
}

/** Render the note symbol(s) for a cell value */
function CellSymbol({ value }: { value: CellValue }) {
  if (value.kind === 'rest') {
    const sym = REST_SYMBOL[value.dur];
    return (
      <span className="cell-note bravura" style={{ fontSize: sym.size }}>
        {sym.char}
      </span>
    );
  }

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

  // Tied notes: show both symbols side-by-side with a tie arc below
  const sym1 = DUR_SYMBOL[value.first];
  const sym2 = DUR_SYMBOL[value.second];
  const tiedSize = 22;
  const tiedDy = 5;
  return (
    <span className="cell-tied">
      <span className="cell-tied-notes">
        <span
          className="cell-note bravura"
          style={{ fontSize: tiedSize, transform: `translateY(${tiedDy}px)` }}
        >
          {sym1.char}
        </span>
        <span
          className="cell-note bravura"
          style={{ fontSize: tiedSize, transform: `translateY(${tiedDy}px)` }}
        >
          {sym2.char}
        </span>
      </span>
      <svg className="tie-arc" viewBox="0 0 36 10" width="36" height="8">
        <path d="M4 2 Q18 10 32 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

/** Toggle a cell between played and rest */
function toggleRest(value: CellValue): CellValue {
  if (value.kind === 'rest') return { kind: 'single', dur: value.dur };
  if (value.kind === 'single') return { kind: 'rest', dur: value.dur };
  // tied → rest using first note's duration
  return { kind: 'rest', dur: value.first };
}

const LONG_PRESS_MS = 500;

export default function GridEditor({ grid, onCellChange, activeBar, activeNote }: GridEditorProps) {
  const activeCells = getBarCells(activeBar);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const cycleValue = useCallback((row: number, col: number) => {
    const current = grid[row][col].value;
    // If it's a rest, cycle the underlying duration but keep it as rest
    if (current.kind === 'rest') {
      const idx = CELL_OPTIONS.findIndex((o) => o.kind === 'single' && o.dur === current.dur);
      const next = CELL_OPTIONS[(idx + 1) % CELL_OPTIONS.length];
      const dur = next.kind === 'single' ? next.dur : next.kind === 'tied' ? next.first : current.dur;
      onCellChange(row, col, { kind: 'rest', dur });
      return;
    }
    const idx = CELL_OPTIONS.findIndex((o) => cellValuesEqual(o, current));
    const next = CELL_OPTIONS[(idx + 1) % CELL_OPTIONS.length];
    onCellChange(row, col, next);
  }, [grid, onCellChange]);

  const handlePointerDown = useCallback((row: number, col: number) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      const current = grid[row][col].value;
      onCellChange(row, col, toggleRest(current));
    }, LONG_PRESS_MS);
  }, [grid, onCellChange]);

  const handlePointerUp = useCallback((row: number, col: number) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!didLongPress.current) {
      cycleValue(row, col);
    }
  }, [cycleValue]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
              className={`grid-cell ${isActive(ri, ci) ? 'active' : ''} ${isPlaying(ri, ci) ? 'playing' : ''} ${cell.value.kind === 'rest' ? 'rest' : ''}`}
              onPointerDown={() => handlePointerDown(ri, ci)}
              onPointerUp={() => handlePointerUp(ri, ci)}
              onPointerLeave={handlePointerLeave}
              title={`${PITCH_NAMES[cell.pitch]} - ${formatBeats(cell.value)} (tap to change, hold for rest)`}
            >
              <CellSymbol value={cell.value} />
              <span className="cell-beats">{formatBeats(cell.value)}</span>
              <span className="cell-pitch">{PITCH_NAMES[cell.pitch]}</span>
            </button>
          ))
        )}
      </div>
      <p className="grid-hint">Tap to cycle duration. Long-press to toggle rest.</p>
    </div>
  );
}
