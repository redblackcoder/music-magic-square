import { useRef, useCallback } from 'react';
import {
  type MusicGrid,
  type CellValue,
  CELL_OPTIONS,
  DUR_SYMBOL,
  REST_SYMBOL,
  PITCH_NAMES,
  formatBeats,
  isRest,
} from '../types';

interface GridEditorProps {
  grid: MusicGrid;
  onCellChange?: (row: number, col: number, value: CellValue) => void;
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
  if (a.kind === 'restPair' && b.kind === 'restPair') return a.first === b.first && a.second === b.second;
  if (a.kind === 'triple' && b.kind === 'triple') return a.first === b.first && a.second === b.second && a.third === b.third;
  if (a.kind === 'restTriple' && b.kind === 'restTriple') return a.first === b.first && a.second === b.second && a.third === b.third;
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

  if (value.kind === 'restPair') {
    const sym1 = REST_SYMBOL[value.first];
    const sym2 = REST_SYMBOL[value.second];
    const restSize = 20;
    return (
      <span className="cell-tied-notes">
        <span className="cell-note bravura" style={{ fontSize: restSize }}>
          {sym1.char}
        </span>
        <span className="cell-note bravura" style={{ fontSize: restSize }}>
          {sym2.char}
        </span>
      </span>
    );
  }

  if (value.kind === 'restTriple') {
    const sym1 = REST_SYMBOL[value.first];
    const sym2 = REST_SYMBOL[value.second];
    const sym3 = REST_SYMBOL[value.third];
    const restSize = 16;
    return (
      <span className="cell-tied-notes">
        <span className="cell-note bravura" style={{ fontSize: restSize }}>
          {sym1.char}
        </span>
        <span className="cell-note bravura" style={{ fontSize: restSize }}>
          {sym2.char}
        </span>
        <span className="cell-note bravura" style={{ fontSize: restSize }}>
          {sym3.char}
        </span>
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

  if (value.kind === 'triple') {
    const sym1 = DUR_SYMBOL[value.first];
    const sym2 = DUR_SYMBOL[value.second];
    const sym3 = DUR_SYMBOL[value.third];
    const tripleSize = 18;
    const tripleDy = 4;
    return (
      <span className="cell-tied">
        <span className="cell-tied-notes">
          <span className="cell-note bravura" style={{ fontSize: tripleSize, transform: `translateY(${tripleDy}px)` }}>
            {sym1.char}
          </span>
          <span className="cell-note bravura" style={{ fontSize: tripleSize, transform: `translateY(${tripleDy}px)` }}>
            {sym2.char}
          </span>
          <span className="cell-note bravura" style={{ fontSize: tripleSize, transform: `translateY(${tripleDy}px)` }}>
            {sym3.char}
          </span>
        </span>
        <svg className="tie-arc" viewBox="0 0 50 10" width="50" height="8">
          <path d="M4 2 Q14 10 24 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M26 2 Q36 10 46 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
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
  if (value.kind === 'restPair') return { kind: 'tied', first: value.first, second: value.second };
  if (value.kind === 'tied') return { kind: 'restPair', first: value.first, second: value.second };
  if (value.kind === 'restTriple') return { kind: 'triple', first: value.first, second: value.second, third: value.third };
  return { kind: 'restTriple', first: value.first, second: value.second, third: value.third };
}

const LONG_PRESS_MS = 500;

export default function GridEditor({ grid, onCellChange, activeBar, activeNote }: GridEditorProps) {
  const activeCells = getBarCells(activeBar);
  const readonly = !onCellChange;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const cycleValue = useCallback((row: number, col: number) => {
    if (!onCellChange) return;
    const current = grid[row][col].value;
    if (isRest(current)) {
      const restOptions = CELL_OPTIONS.map(toggleRest);
      const idx = restOptions.findIndex((o) => cellValuesEqual(o, current));
      const next = restOptions[(idx + 1) % restOptions.length];
      onCellChange(row, col, next);
      return;
    }
    const idx = CELL_OPTIONS.findIndex((o) => cellValuesEqual(o, current));
    const next = CELL_OPTIONS[(idx + 1) % CELL_OPTIONS.length];
    onCellChange(row, col, next);
  }, [grid, onCellChange]);

  const handlePointerDown = useCallback((row: number, col: number) => {
    if (!onCellChange) return;
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      const current = grid[row][col].value;
      onCellChange(row, col, toggleRest(current));
    }, LONG_PRESS_MS);
  }, [grid, onCellChange]);

  const handlePointerUp = useCallback((row: number, col: number) => {
    if (!onCellChange) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!didLongPress.current) {
      cycleValue(row, col);
    }
  }, [onCellChange, cycleValue]);

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
              className={`grid-cell ${isActive(ri, ci) ? 'active' : ''} ${isPlaying(ri, ci) ? 'playing' : ''} ${isRest(cell.value) ? 'rest' : ''}`}
              onPointerDown={readonly ? undefined : () => handlePointerDown(ri, ci)}
              onPointerUp={readonly ? undefined : () => handlePointerUp(ri, ci)}
              onPointerLeave={readonly ? undefined : handlePointerLeave}
              onFocus={(e) => e.target.blur()}
              title={`${PITCH_NAMES[cell.pitch]} - ${formatBeats(cell.value)}`}
              style={readonly ? { cursor: 'default' } : undefined}
            >
              <CellSymbol value={cell.value} />
              <span className="cell-beats">{formatBeats(cell.value)}</span>
              <span className="cell-pitch">{PITCH_NAMES[cell.pitch]}</span>
            </button>
          ))
        )}
      </div>
      {!readonly && <p className="grid-hint">Tap to cycle duration. Long-press to toggle rest.</p>}
    </div>
  );
}
