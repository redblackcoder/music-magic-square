import type { CellValue, NoteDuration } from './types';

export const DUR_TO_NUM: Record<NoteDuration, string> = {
  '1/16': '1',
  '1/8': '2',
  '1/4': '4',
  '1/2': '8',
};

export const NUM_TO_DUR: Record<string, NoteDuration> = {
  '1': '1/16',
  '2': '1/8',
  '4': '1/4',
  '8': '1/2',
};

export const VALID_SINGLES = new Set(['1', '2', '4', '8']);

export const VALID_PAIRS: Record<string, [string, string]> = {
  '1+2': ['1', '2'], '1+4': ['1', '4'], '1+8': ['1', '8'],
  '2+4': ['2', '4'], '2+8': ['2', '8'], '4+8': ['4', '8'],
  '2+1': ['1', '2'], '4+1': ['1', '4'], '8+1': ['1', '8'],
  '4+2': ['2', '4'], '8+2': ['2', '8'], '8+4': ['4', '8'],
};

export const COMPOUND_TO_PAIR: Record<string, [string, string]> = {
  '3': ['1', '2'], '5': ['1', '4'], '6': ['2', '4'],
  '9': ['1', '8'], '10': ['2', '8'],
};

export const COMPOUND_TRIPLE: Record<string, [string, string, string]> = {
  '7': ['4', '2', '1'],
};

/** Parse a text string like "4", "1+2", or "3" into a CellValue, or null if invalid */
export function parseInput(text: string): CellValue | null {
  const clean = text.replace(/\s/g, '');
  if (VALID_SINGLES.has(clean) && NUM_TO_DUR[clean]) {
    return { kind: 'single', dur: NUM_TO_DUR[clean] };
  }
  const triple = COMPOUND_TRIPLE[clean];
  if (triple) {
    return { kind: 'triple', first: NUM_TO_DUR[triple[0]], second: NUM_TO_DUR[triple[1]], third: NUM_TO_DUR[triple[2]] };
  }
  const compound = COMPOUND_TO_PAIR[clean];
  if (compound) {
    return { kind: 'tied', first: NUM_TO_DUR[compound[0]], second: NUM_TO_DUR[compound[1]] };
  }
  const pair = VALID_PAIRS[clean];
  if (pair) {
    return { kind: 'tied', first: NUM_TO_DUR[pair[0]], second: NUM_TO_DUR[pair[1]] };
  }
  return null;
}

/** Convert cell text to its sixteenths value (1-10), or null if invalid */
export function textToSixteenths(text: string): number | null {
  const clean = text.replace(/\s/g, '');
  if (clean === '') return null;

  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 10 && String(num) === clean) {
    if (parseInput(clean) !== null) return num;
  }

  if (clean.includes('+')) {
    const parts = clean.split('+').map(p => parseInt(p, 10));
    if (parts.every(p => !isNaN(p))) {
      const sum = parts.reduce((a, b) => a + b, 0);
      if (parseInput(clean) !== null) return sum;
    }
  }

  return null;
}
