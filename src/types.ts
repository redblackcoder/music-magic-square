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

/** Bravura (SMuFL) symbol data for each note type */
export const NOTE_SYMBOL: Record<NoteType, { char: string; size: number; dy: number }> = {
  quarter: { char: '\uE1D5', size: 34, dy: 8 },
  half:    { char: '\uE1D3', size: 34, dy: 8 },
  whole:   { char: '\uE1D2', size: 34, dy: 2 },
  eighth:  { char: '\uE1D7', size: 34, dy: 8 },
  rest:    { char: '\uE4E5', size: 34, dy: 6 },
};

/** All available note types for cycling */
export const NOTE_TYPES: NoteType[] = ['quarter', 'half', 'whole', 'eighth', 'rest'];

/** Default pitches for a 4x4 grid — C major scale spread across 2 octaves */
export const DEFAULT_PITCHES: number[][] = [
  [60, 62, 64, 65], // C4 D4 E4 F4
  [67, 69, 71, 72], // G4 A4 B4 C5
  [74, 76, 77, 79], // D5 E5 F5 G5
  [81, 83, 84, 86], // A5 B5 C6 D6
];

export const PITCH_NAMES: Record<number, string> = {
  60: 'C4', 62: 'D4', 64: 'E4', 65: 'F4',
  67: 'G4', 69: 'A4', 71: 'B4', 72: 'C5',
  74: 'D5', 76: 'E5', 77: 'F5', 79: 'G5',
  81: 'A5', 83: 'B5', 84: 'C6', 86: 'D6',
};
