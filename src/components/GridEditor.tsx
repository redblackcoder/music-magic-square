import { type MusicGrid, NOTE_TYPES, PITCH_NAMES, type NoteType } from '../types';

interface GridEditorProps {
  grid: MusicGrid;
  onCellChange: (row: number, col: number, note: NoteType) => void;
  activeBar: number;
  activeNote: number;
}

/** Get which cells are highlighted for a given bar index */
function getBarCells(barIndex: number): [number, number][] {
  if (barIndex < 0) return [];
  if (barIndex < 4) {
    // Row
    return [0, 1, 2, 3].map((c) => [barIndex, c]);
  }
  if (barIndex < 8) {
    // Column
    const col = barIndex - 4;
    return [0, 1, 2, 3].map((r) => [r, col]);
  }
  if (barIndex === 8) {
    // Main diagonal
    return [[0, 0], [1, 1], [2, 2], [3, 3]];
  }
  // Anti-diagonal
  return [[0, 3], [1, 2], [2, 1], [3, 0]];
}

export default function GridEditor({ grid, onCellChange, activeBar, activeNote }: GridEditorProps) {
  const activeCells = getBarCells(activeBar);

  function cycleNote(row: number, col: number) {
    const current = grid[row][col].note;
    const idx = NOTE_TYPES.indexOf(current);
    const next = NOTE_TYPES[(idx + 1) % NOTE_TYPES.length];
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
              className={`grid-cell ${isActive(ri, ci) ? 'active' : ''} ${isPlaying(ri, ci) ? 'playing' : ''} note-${cell.note}`}
              onClick={() => cycleNote(ri, ci)}
              title={`${PITCH_NAMES[cell.pitch]} - ${cell.note} (tap to change)`}
            >
              <span className="cell-note">{getNoteSymbol(cell.note)}</span>
              <span className="cell-pitch">{PITCH_NAMES[cell.pitch]}</span>
            </button>
          ))
        )}
      </div>
      <p className="grid-hint">Tap a cell to cycle through note types</p>
    </div>
  );
}

function getNoteSymbol(note: NoteType): string {
  switch (note) {
    case 'quarter': return '\u2669';
    case 'half': return '\uD834\uDD5E';
    case 'whole': return '\uD834\uDD5D';
    case 'eighth': return '\u266A';
    case 'rest': return '\u{1D13D}';
  }
}
