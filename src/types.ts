/** Musical note types that can appear in a grid cell */
export type NoteType = 'quarter' | 'half' | 'whole' | 'eighth' | 'rest';

/** A single cell in the 4x4 grid */
export interface GridCell {
  row: number;
  col: number;
  note: NoteType;
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

/** Note duration in beats */
export const NOTE_DURATIONS: Record<NoteType, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  rest: 1,
};

/** Bravura (SMuFL) symbol data for each note type — used in the grid editor cells */
export const NOTE_SYMBOL: Record<NoteType, { char: string; size: number; dy: number }> = {
  quarter: { char: '\uE1D5', size: 34, dy: 8 },
  half:    { char: '\uE1D3', size: 34, dy: 8 },
  whole:   { char: '\uE1D2', size: 34, dy: 2 },
  eighth:  { char: '\uE1D7', size: 34, dy: 8 },
  rest:    { char: '\uE4E5', size: 34, dy: 6 },
};

/** Bravura notehead characters for staff rendering (separate heads without stems) */
export const NOTEHEAD_CHAR: Record<NoteType, string> = {
  quarter: '\uE0A4', // noteheadBlack
  half:    '\uE0A3', // noteheadHalf
  whole:   '\uE0A2', // noteheadWhole
  eighth:  '\uE0A4', // noteheadBlack (stem+flag added separately)
  rest:    '\uE4E5', // restQuarter
};

/** G-clef (treble clef) Bravura character */
export const GCLEF_CHAR = '\uE050';

/** All available note types for cycling */
export const NOTE_TYPES: NoteType[] = ['quarter', 'half', 'whole', 'eighth', 'rest'];

/**
 * C Major Pentatonic pitches arranged in a "magic square" pattern.
 * 16 notes from C4–C7 using only C D E G A (no semitones = always consonant).
 * Each row, column, and diagonal mixes registers for melodic variety.
 */
export const DEFAULT_PITCHES: number[][] = [
  [69, 76, 60, 84], // A4  E5  C4  C6
  [74, 67, 81, 64], // D5  G4  A5  E4
  [72, 93, 62, 88], // C5  A6  D4  E6
  [91, 86, 79, 96], // G6  D6  G5  C7
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
 * Negative = below staff, >8 = above staff.
 */
export const STAFF_POSITION: Record<number, number> = {
  60: -2,  // C4 — ledger line below
  62: -1,  // D4
  64:  0,  // E4 — bottom line
  67:  2,  // G4 — second line
  69:  3,  // A4
  72:  5,  // C5
  74:  6,  // D5 — fourth line
  76:  7,  // E5
  79:  9,  // G5 — above staff
  81: 10,  // A5
  84: 12,  // C6
  86: 13,  // D6
  88: 14,  // E6
  91: 16,  // G6
  93: 17,  // A6
  96: 19,  // C7
};
