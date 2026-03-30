import { type Bar, STAFF_POSITION, NOTEHEAD_CHAR, GCLEF_CHAR, type NoteType } from '../types';

interface StaffDisplayProps {
  bars: Bar[];
  activeBar: number;
  activeNote: number;
}

// Staff geometry constants
const STAFF_W = 320;      // total SVG width
const STAFF_H = 100;      // total SVG height
const LINE_GAP = 8;       // pixels between adjacent staff lines
const STAFF_TOP = 28;     // y of top staff line (F5)
const STAFF_BOT = STAFF_TOP + 4 * LINE_GAP; // y of bottom staff line (E4)
const CLEF_X = 12;        // x position for clef
const NOTE_START_X = 56;  // x of first note
const NOTE_GAP = 62;      // horizontal spacing between notes
const HALF_GAP = LINE_GAP / 2; // half a staff-line gap (one diatonic step)

/** Convert a staff position (0 = E4 bottom line) to a y-coordinate */
function posToY(pos: number): number {
  return STAFF_BOT - pos * HALF_GAP;
}

/** Does this staff position sit on a line (even positions on the 5 main lines)? */
function needsLedgerLines(pos: number): number[] {
  const ledgers: number[] = [];
  // Below staff: positions -2, -4, -6...
  if (pos <= -2) {
    for (let p = -2; p >= pos; p -= 2) ledgers.push(p);
  }
  // Above staff: positions 10, 12, 14...
  if (pos >= 10) {
    for (let p = 10; p <= pos; p += 2) ledgers.push(p);
  }
  return ledgers;
}

/** Should the stem go up (below middle line) or down (above)? */
function stemUp(pos: number): boolean {
  return pos < 4; // B4 line (pos 4) is the middle; below → stem up
}

function NoteGlyph({ note, pos, x, playing }: { note: NoteType; pos: number; x: number; playing: boolean }) {
  const y = posToY(pos);
  const head = NOTEHEAD_CHAR[note];
  const color = playing ? '#ffd700' : '#ccd6f6';

  if (note === 'rest') {
    // Rest sits at center of staff regardless of pitch
    return (
      <text
        x={x}
        y={posToY(4)}
        fill={color}
        fontFamily="Bravura, serif"
        fontSize={22}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {head}
      </text>
    );
  }

  const up = stemUp(pos);
  const stemLen = 28;
  // Stem attaches to the right side going up, or left side going down
  const stemX = up ? x + 5.5 : x - 5.5;
  const stemY1 = y;
  const stemY2 = up ? y - stemLen : y + stemLen;

  return (
    <g>
      {/* Ledger lines */}
      {needsLedgerLines(pos).map((lp) => (
        <line
          key={lp}
          x1={x - 9}
          x2={x + 9}
          y1={posToY(lp)}
          y2={posToY(lp)}
          stroke={color}
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      {/* Notehead */}
      <text
        x={x}
        y={y}
        fill={color}
        fontFamily="Bravura, serif"
        fontSize={20}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {head}
      </text>

      {/* Stem (not for whole notes) */}
      {note !== 'whole' && (
        <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={color} strokeWidth={1.2} />
      )}

      {/* Eighth note flag */}
      {note === 'eighth' && up && (
        <text
          x={stemX}
          y={stemY2}
          fill={color}
          fontFamily="Bravura, serif"
          fontSize={20}
          textAnchor="start"
          dominantBaseline="auto"
        >
          {'\uE240'}
        </text>
      )}
      {note === 'eighth' && !up && (
        <text
          x={stemX}
          y={stemY2}
          fill={color}
          fontFamily="Bravura, serif"
          fontSize={20}
          textAnchor="start"
          dominantBaseline="hanging"
        >
          {'\uE241'}
        </text>
      )}
    </g>
  );
}

function StaffBar({ bar, isActive, activeNoteIdx }: {
  bar: Bar;
  isActive: boolean;
  activeNoteIdx: number;
}) {
  return (
    <div className={`staff-bar ${isActive ? 'active' : ''}`}>
      <span className="staff-label">{bar.label}</span>
      <svg
        viewBox={`0 0 ${STAFF_W} ${STAFF_H}`}
        width={STAFF_W}
        height={STAFF_H}
        className="staff-svg"
      >
        {/* 5 staff lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={0}
            y1={STAFF_TOP + i * LINE_GAP}
            x2={STAFF_W}
            y2={STAFF_TOP + i * LINE_GAP}
            stroke="rgba(168,178,209,0.3)"
            strokeWidth={1}
          />
        ))}

        {/* G-clef */}
        <text
          x={CLEF_X}
          y={posToY(2)}
          fill="rgba(168,178,209,0.5)"
          fontFamily="Bravura, serif"
          fontSize={32}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {GCLEF_CHAR}
        </text>

        {/* Notes */}
        {bar.cells.map((cell, ni) => {
          const pos = STAFF_POSITION[cell.pitch] ?? 0;
          const x = NOTE_START_X + ni * NOTE_GAP;
          return (
            <NoteGlyph
              key={ni}
              note={cell.note}
              pos={pos}
              x={x}
              playing={isActive && ni === activeNoteIdx}
            />
          );
        })}

        {/* Final barline */}
        <line
          x1={STAFF_W - 4}
          y1={STAFF_TOP}
          x2={STAFF_W - 4}
          y2={STAFF_BOT}
          stroke="rgba(168,178,209,0.3)"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

export default function StaffDisplay({ bars, activeBar, activeNote }: StaffDisplayProps) {
  return (
    <div className="staff-display">
      <h3>10 Bars</h3>
      <div className="staff-list">
        {bars.map((bar, bi) => (
          <StaffBar
            key={bi}
            bar={bar}
            isActive={bi === activeBar}
            activeNoteIdx={activeNote}
          />
        ))}
      </div>
    </div>
  );
}
