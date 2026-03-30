import { useRef, useEffect } from 'react';
import { type Bar, type CellValue, DUR_SYMBOL, STAFF_POSITION, GCLEF_CHAR } from '../types';

interface StaffDisplayProps {
  bars: Bar[];
  activeBar: number;
  activeNote: number;
}

// Layout constants
const LINE_GAP = 10;          // pixels between staff lines
const HALF_GAP = LINE_GAP / 2;
const STAFF_CENTER_Y = 80;    // y of the middle line (B4, position 4)
const STAFF_TOP_Y = STAFF_CENTER_Y - 2 * LINE_GAP;   // top line (F5)
const STAFF_BOT_Y = STAFF_CENTER_Y + 2 * LINE_GAP;   // bottom line (E4)
const SVG_H = 160;            // total height — enough room for ledger lines
const CLEF_W = 40;            // space for the clef
const BAR_W = 200;            // width per bar
const NOTE_PAD = 30;          // first note offset within a bar
const NOTE_GAP = 42;          // spacing between notes in a bar

const TOTAL_W = CLEF_W + 10 * BAR_W + 10; // 10 bars + clef + padding

/** Convert staff position (0 = E4 bottom line) to y coordinate */
function posToY(pos: number): number {
  // pos 0 = bottom line (E4) = STAFF_BOT_Y
  // pos 8 = top line (F5) = STAFF_TOP_Y
  return STAFF_BOT_Y - pos * HALF_GAP;
}

/** Get ledger line positions needed for a note at given staff position */
function ledgerLines(pos: number): number[] {
  const lines: number[] = [];
  if (pos <= -2) {
    for (let p = -2; p >= pos; p -= 2) lines.push(p);
  }
  if (pos >= 10) {
    for (let p = 10; p <= pos; p += 2) lines.push(p);
  }
  // Also need middle C ledger line at pos -2 if note is at -1 or -2
  return lines;
}

/** Get the Bravura symbol for a single duration */
function getDurChar(dur: string): string {
  return DUR_SYMBOL[dur as keyof typeof DUR_SYMBOL]?.char ?? '\uE1D5';
}

/** Render a single note or tied pair on the staff */
function NoteOnStaff({ value, pitch, x, playing }: {
  value: CellValue;
  pitch: number;
  x: number;
  playing: boolean;
}) {
  const pos = STAFF_POSITION[pitch] ?? 0;
  const y = posToY(pos);
  const color = playing ? '#ffd700' : '#ccd6f6';
  const fontSize = 28;
  // Bravura glyphs have their origin at the notehead center when using baseline adjustments
  // We use a manual dy offset to align the notehead with the staff line
  const glyphDy = 0.35 * fontSize; // empirical offset for Bravura glyphs

  const lLines = ledgerLines(pos);

  if (value.kind === 'single') {
    return (
      <g>
        {lLines.map((lp) => (
          <line
            key={lp}
            x1={x - 10} x2={x + 10}
            y1={posToY(lp)} y2={posToY(lp)}
            stroke={color} strokeWidth={1} opacity={0.5}
          />
        ))}
        <text
          x={x} y={y + glyphDy}
          fill={color}
          fontFamily="Bravura, serif"
          fontSize={fontSize}
          textAnchor="middle"
        >
          {getDurChar(value.dur)}
        </text>
      </g>
    );
  }

  // Tied notes: render first note, then second note slightly right, with a tie arc
  const gap = 22;
  const x1 = x - gap / 2;
  const x2 = x + gap / 2;
  const smallSize = fontSize * 0.75;
  const smallDy = 0.35 * smallSize;

  return (
    <g>
      {lLines.map((lp) => (
        <line
          key={lp}
          x1={x - 14} x2={x + 14}
          y1={posToY(lp)} y2={posToY(lp)}
          stroke={color} strokeWidth={1} opacity={0.5}
        />
      ))}
      <text
        x={x1} y={y + smallDy}
        fill={color}
        fontFamily="Bravura, serif"
        fontSize={smallSize}
        textAnchor="middle"
      >
        {getDurChar(value.first)}
      </text>
      {/* Tie arc */}
      <path
        d={`M${x1 + 4} ${y + 4} Q${x} ${y + 12} ${x2 - 4} ${y + 4}`}
        fill="none" stroke={color} strokeWidth={1.2}
      />
      <text
        x={x2} y={y + smallDy}
        fill={color}
        fontFamily="Bravura, serif"
        fontSize={smallSize}
        textAnchor="middle"
      >
        {getDurChar(value.second)}
      </text>
    </g>
  );
}

export default function StaffDisplay({ bars, activeBar, activeNote }: StaffDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<(SVGGElement | null)[]>([]);

  // Auto-scroll to active bar during playback
  useEffect(() => {
    if (activeBar < 0 || !scrollRef.current) return;
    const barX = CLEF_W + activeBar * BAR_W;
    const container = scrollRef.current;
    const targetScroll = barX - container.clientWidth / 2 + BAR_W / 2;
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [activeBar]);

  return (
    <div className="staff-display">
      <div className="staff-scroll" ref={scrollRef}>
        <svg
          viewBox={`0 0 ${TOTAL_W} ${SVG_H}`}
          width={TOTAL_W}
          height={SVG_H}
          className="staff-svg"
        >
          {/* 5 staff lines across full width */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={0} x2={TOTAL_W}
              y1={STAFF_TOP_Y + i * LINE_GAP}
              y2={STAFF_TOP_Y + i * LINE_GAP}
              stroke="rgba(168,178,209,0.3)" strokeWidth={1}
            />
          ))}

          {/* G-clef */}
          <text
            x={CLEF_W / 2}
            y={posToY(2) + 0.35 * 38}
            fill="rgba(168,178,209,0.5)"
            fontFamily="Bravura, serif"
            fontSize={38}
            textAnchor="middle"
          >
            {GCLEF_CHAR}
          </text>

          {/* Bars */}
          {bars.map((bar, bi) => {
            const barStartX = CLEF_W + bi * BAR_W;
            const isActive = bi === activeBar;

            return (
              <g key={bi}>
                {/* Active bar background highlight */}
                {isActive && (
                  <rect
                    x={barStartX} y={STAFF_TOP_Y - 20}
                    width={BAR_W} height={SVG_H - STAFF_TOP_Y + 10}
                    fill="rgba(233,69,96,0.06)" rx={4}
                  />
                )}

                {/* Bar label */}
                <text
                  x={barStartX + BAR_W / 2}
                  y={STAFF_TOP_Y - 8}
                  fill={isActive ? '#e94560' : 'rgba(168,178,209,0.4)'}
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {bar.label}
                </text>

                {/* Notes */}
                {bar.cells.map((cell, ni) => {
                  const noteX = barStartX + NOTE_PAD + ni * NOTE_GAP;
                  const isPlayingNote = isActive && ni === activeNote;
                  return (
                    <g key={ni} ref={(el) => { noteRefs.current[bi * 4 + ni] = el; }}>
                      <NoteOnStaff
                        value={cell.value}
                        pitch={cell.pitch}
                        x={noteX}
                        playing={isPlayingNote}
                      />
                    </g>
                  );
                })}

                {/* Bar line */}
                <line
                  x1={barStartX + BAR_W} x2={barStartX + BAR_W}
                  y1={STAFF_TOP_Y} y2={STAFF_BOT_Y}
                  stroke="rgba(168,178,209,0.25)" strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Final double bar line */}
          <line
            x1={TOTAL_W - 6} x2={TOTAL_W - 6}
            y1={STAFF_TOP_Y} y2={STAFF_BOT_Y}
            stroke="rgba(168,178,209,0.4)" strokeWidth={2.5}
          />
          <line
            x1={TOTAL_W - 2} x2={TOTAL_W - 2}
            y1={STAFF_TOP_Y} y2={STAFF_BOT_Y}
            stroke="rgba(168,178,209,0.4)" strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
}
