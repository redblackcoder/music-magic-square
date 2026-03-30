/** Individual note duration (fraction of a whole note / bar in 4/4) */
export type NoteDuration = '1/2' | '1/4' | '1/8' | '1/16';

/** A cell can hold a single note or two notes tied together */
export type CellValue =
  | { kind: 'single'; dur: NoteDuration }
  | { kind: 'tied'; first: NoteDuration; second: NoteDuration };

/** Beat value of each note duration (fraction of a whole bar) */
export const BEAT_VALUES: Record<NoteDuration, number> = {
  '1/2': 0.5,
  '1/4': 0.25,
  '1/8': 0.125,
  '1/16': 0.0625,
};

/** Get the total beat value of a cell */
export function getCellBeats(value: CellValue): number {
  if (value.kind === 'single') return BEAT_VALUES[value.dur];
  return BEAT_VALUES[value.first] + BEAT_VALUES[value.second];
}

/** Format cell beats as a fraction string */
export function formatBeats(value: CellValue): string {
  const b = getCellBeats(value);
  // Convert to sixteenths for clean fraction display
  const sixteenths = Math.round(b * 16);
  if (sixteenths === 16) return '1';
  if (sixteenths === 8) return '1/2';
  if (sixteenths === 4) return '1/4';
  if (sixteenths === 2) return '1/8';
  if (sixteenths === 1) return '1/16';
  return `${sixteenths}/16`;
}

/** A single cell in the 4x4 grid */
export interface GridCell {
  row: number;
  col: number;
  value: CellValue;
  /** MIDI pitch (e.g. 60 = C4). Assigned based on position. */
  pitch: number;
}

/** The 4x4 music grid */
export type MusicGrid = GridCell[][];

/** A bar is a sequence of 4 notes */
export interface Bar {
  label: string;
  cells: GridCell[];
}

/** All cell values the user can cycle through (tap to change) */
export const CELL_OPTIONS: CellValue[] = [
  { kind: 'single', dur: '1/2' },
  { kind: 'single', dur: '1/4' },
  { kind: 'single', dur: '1/8' },
  { kind: 'single', dur: '1/16' },
  { kind: 'tied', first: '1/8', second: '1/16' },   // 3/16
  { kind: 'tied', first: '1/4', second: '1/16' },   // 5/16
  { kind: 'tied', first: '1/4', second: '1/8' },    // 3/8
  { kind: 'tied', first: '1/2', second: '1/16' },   // 9/16
  { kind: 'tied', first: '1/2', second: '1/8' },    // 5/8
  { kind: 'tied', first: '1/2', second: '1/4' },    // 3/4
];

/** Bravura (SMuFL) full-glyph characters for each duration (includes stem) */
export const DUR_SYMBOL: Record<NoteDuration, { char: string; size: number; dy: number }> = {
  '1/2':  { char: '\uE1D3', size: 34, dy: 8 },   // noteHalfUp
  '1/4':  { char: '\uE1D5', size: 34, dy: 8 },   // noteQuarterUp
  '1/8':  { char: '\uE1D7', size: 34, dy: 8 },   // note8thUp
  '1/16': { char: '\uE1D9', size: 34, dy: 8 },   // note16thUp
};

/** G-clef (treble clef) Bravura character */
export const GCLEF_CHAR = '\uE050';

/** All available note durations */
export const NOTE_DURATIONS: NoteDuration[] = ['1/2', '1/4', '1/8', '1/16'];

/**
 * C Major Pentatonic pitches in a magic square arrangement.
 * Each row/col/diagonal mixes registers for melodic variety.
 */
export const DEFAULT_PITCHES: number[][] = [
  [69, 76, 60, 84], // A4  E5  C4  C6
  [74, 67, 81, 64], // D5  G4  A5  E4
  [72, 93, 62, 88], // C5  A6  D4  E6
  [91, 86, 79, 96], // G6  D6  G5  C7
];

/**
 * Default cell values: a magic square where every row, col, and diagonal sums to 1.
 * Uses values: 1/2, 1/4, 1/16, 3/16 (= 1/8+1/16 tied).
 * 8/16 + 4/16 + 1/16 + 3/16 = 16/16 = 1 for each line.
 */
export const DEFAULT_VALUES: CellValue[][] = [
  [
    { kind: 'single', dur: '1/2' },
    { kind: 'single', dur: '1/4' },
    { kind: 'single', dur: '1/16' },
    { kind: 'tied', first: '1/8', second: '1/16' },
  ],
  [
    { kind: 'single', dur: '1/16' },
    { kind: 'tied', first: '1/8', second: '1/16' },
    { kind: 'single', dur: '1/2' },
    { kind: 'single', dur: '1/4' },
  ],
  [
    { kind: 'tied', first: '1/8', second: '1/16' },
    { kind: 'single', dur: '1/16' },
    { kind: 'single', dur: '1/4' },
    { kind: 'single', dur: '1/2' },
  ],
  [
    { kind: 'single', dur: '1/4' },
    { kind: 'single', dur: '1/2' },
    { kind: 'tied', first: '1/8', second: '1/16' },
    { kind: 'single', dur: '1/16' },
  ],
];

/** Map every MIDI pitch we use to its display name */
export const PITCH_NAMES: Record<number, string> = {
  60: 'C4', 62: 'D4', 64: 'E4', 67: 'G4', 69: 'A4',
  72: 'C5', 74: 'D5', 76: 'E5', 79: 'G5', 81: 'A5',
  84: 'C6', 86: 'D6', 88: 'E6', 91: 'G6', 93: 'A6',
  96: 'C7',
};

/**
 * Map MIDI pitch to diatonic staff position in treble clef.
 * Position 0 = bottom staff line (E4). Each step = one diatonic position.
 */
export const STAFF_POSITION: Record<number, number> = {
  60: -2,  // C4
  62: -1,  // D4
  64:  0,  // E4 — bottom line
  67:  2,  // G4 — second line
  69:  3,  // A4
  72:  5,  // C5
  74:  6,  // D5
  76:  7,  // E5
  79:  9,  // G5
  81: 10,  // A5
  84: 12,  // C6
  86: 13,  // D6
  88: 14,  // E6
  91: 16,  // G6
  93: 17,  // A6
  96: 19,  // C7
};
