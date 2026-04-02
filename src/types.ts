/** Individual note duration (fraction of a whole note / bar in 4/4) */
export type NoteDuration = '1/2' | '1/4' | '1/8' | '1/16';

/** A cell can hold a single note, two notes tied together, or a rest */
export type CellValue =
  | { kind: 'single'; dur: NoteDuration }
  | { kind: 'tied'; first: NoteDuration; second: NoteDuration }
  | { kind: 'triple'; first: NoteDuration; second: NoteDuration; third: NoteDuration }
  | { kind: 'rest'; dur: NoteDuration }
  | { kind: 'restPair'; first: NoteDuration; second: NoteDuration }
  | { kind: 'restTriple'; first: NoteDuration; second: NoteDuration; third: NoteDuration };

/** Beat value of each note duration (fraction of a whole bar) */
export const BEAT_VALUES: Record<NoteDuration, number> = {
  '1/2': 0.5,
  '1/4': 0.25,
  '1/8': 0.125,
  '1/16': 0.0625,
};

/** Get the total beat value of a cell */
export function getCellBeats(value: CellValue): number {
  if (value.kind === 'single' || value.kind === 'rest') return BEAT_VALUES[value.dur];
  if (value.kind === 'triple' || value.kind === 'restTriple')
    return BEAT_VALUES[value.first] + BEAT_VALUES[value.second] + BEAT_VALUES[value.third];
  return BEAT_VALUES[value.first] + BEAT_VALUES[value.second];
}

/** Check if a cell value is any kind of rest */
export function isRest(value: CellValue): boolean {
  return value.kind === 'rest' || value.kind === 'restPair' || value.kind === 'restTriple';
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
  { kind: 'triple', first: '1/4', second: '1/8', third: '1/16' },  // 7/16
];

/** Bravura (SMuFL) full-glyph characters for each duration (includes stem) */
export const DUR_SYMBOL: Record<NoteDuration, { char: string; size: number; dy: number }> = {
  '1/2':  { char: '\uE1D3', size: 34, dy: 8 },   // noteHalfUp
  '1/4':  { char: '\uE1D5', size: 34, dy: 8 },   // noteQuarterUp
  '1/8':  { char: '\uE1D7', size: 34, dy: 8 },   // note8thUp
  '1/16': { char: '\uE1D9', size: 34, dy: 8 },   // note16thUp
};

/** Bravura (SMuFL) rest glyphs for each duration */
export const REST_SYMBOL: Record<NoteDuration, { char: string; size: number }> = {
  '1/2':  { char: '\uE4E4', size: 28 },   // restHalf
  '1/4':  { char: '\uE4E5', size: 28 },   // restQuarter
  '1/8':  { char: '\uE4E6', size: 28 },   // rest8th
  '1/16': { char: '\uE4E7', size: 28 },   // rest16th
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
  58: 'Bb3', 59: 'B3',
  60: 'C4', 61: 'Db4', 62: 'D4', 63: 'Eb4', 64: 'E4', 65: 'F4', 66: 'F#4', 67: 'G4', 68: 'Ab4', 69: 'A4', 70: 'Bb4', 71: 'B4',
  72: 'C5', 73: 'Db5', 74: 'D5', 75: 'Eb5', 76: 'E5', 77: 'F5', 78: 'F#5', 79: 'G5', 81: 'A5',
  82: 'Bb5', 83: 'B5', 84: 'C6', 86: 'D6', 88: 'E6', 89: 'F6',
  91: 'G6', 93: 'A6', 96: 'C7',
};

/**
 * Map MIDI pitch to diatonic staff position in treble clef.
 * Position 0 = bottom staff line (E4). Each step = one diatonic position.
 * Sharps/flats share the same line as their natural note.
 */
export const STAFF_POSITION: Record<number, number> = {
  58: -3,  // Bb3 (same line as B3)
  59: -3,  // B3
  60: -2,  // C4
  61: -1,  // Db4 (same line as D4)
  62: -1,  // D4
  63:  0,  // Eb4 (same line as E4)
  64:  0,  // E4 — bottom line
  65:  1,  // F4
  66:  1,  // F#4 (same line as F4)
  67:  2,  // G4 — second line
  68:  3,  // Ab4 (same line as A4)
  69:  3,  // A4
  70:  4,  // Bb4 (same line as B4)
  71:  4,  // B4 — middle line
  72:  5,  // C5
  73:  6,  // Db5 (same line as D5)
  74:  6,  // D5
  75:  7,  // Eb5 (same line as E5)
  76:  7,  // E5
  77:  8,  // F5 — top line
  78:  8,  // F#5 (same line as F5)
  79:  9,  // G5
  81: 10,  // A5
  82: 11,  // Bb5 (same line as B5)
  83: 11,  // B5
  84: 12,  // C6
  86: 13,  // D6
  88: 14,  // E6
  89: 15,  // F6
  91: 16,  // G6
  93: 17,  // A6
  96: 19,  // C7
};

/** A named melody preset with a 4x4 pitch grid */
export interface MelodyPreset {
  name: string;
  pitches: number[][];
}

export const MELODY_PRESETS: MelodyPreset[] = [
  {
    name: 'C Major Pentatonic',
    pitches: DEFAULT_PITCHES,
  },
  {
    name: 'D Minor Pentatonic',
    pitches: [
      [65, 72, 58, 77],  // F4  C5  Bb3  F5
      [70, 63, 75, 60],  // Bb4 Eb4 Eb5  C4
      [62, 82, 67, 79],  // D4  Bb5 G4   G5
      [84, 74, 69, 89],  // C6  D5  A4   F6
    ],
  },
  {
    name: 'Blues Scale',
    pitches: [
      [63, 70, 58, 75],  // Eb4 Bb4 Bb3 Eb5
      [66, 61, 73, 60],  // F#4 Db4 Db5 C4
      [60, 78, 65, 72],  // C4  F#5 F4  C5
      [82, 68, 67, 84],  // Bb5 Ab4 G4  C6
    ],
  },
  {
    name: 'Japanese (In Sen)',
    pitches: [
      [64, 71, 59, 76],  // E4  B4  B3  E5
      [65, 60, 72, 61],  // F4  C4  C5  Db4
      [69, 81, 67, 77],  // A4  A5  G4  F5
      [83, 76, 72, 88],  // B5  E5  C5  E6
    ],
  },
];
