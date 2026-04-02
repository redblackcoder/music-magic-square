import { PUZZLES, type PrintPuzzle } from '../generatedPuzzles';

/** QR code for production URL (from QRShare.tsx) */
function QRCode({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 37 37"
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <path fill="#ffffff" d="M0 0h37v37H0z" />
      <path
        stroke="#1a1a2e"
        d="M4 4.5h7m2 0h2m3 0h1m1 0h1m2 0h2m1 0h7M4 5.5h1m5 0h1m2 0h3m3 0h1m4 0h1m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m1 0h1m1 0h1m4 0h1m6 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h3m4 0h3m2 0h1m1 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h2m2 0h2m2 0h1m1 0h3m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h3m1 0h5m1 0h1m1 0h1m1 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h1m1 0h2m1 0h1m1 0h1m3 0h1M4 12.5h1m1 0h5m2 0h3m2 0h2m1 0h1m2 0h1m1 0h5M4 13.5h3m2 0h1m1 0h1m4 0h1m3 0h1m2 0h6m3 0h1M4 14.5h2m1 0h2m1 0h1m5 0h1m2 0h1m1 0h2m1 0h2m1 0h2M7 15.5h2m5 0h2m2 0h1m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1M4 16.5h3m1 0h4m3 0h1m5 0h1m1 0h1m1 0h1m3 0h2M4 17.5h1m1 0h2m3 0h2m2 0h4m3 0h2m1 0h4m3 0h1M4 18.5h2m3 0h3m1 0h7m4 0h1m1 0h2m1 0h2M4 19.5h1m1 0h1m1 0h2m1 0h1m2 0h1m1 0h2m1 0h2m2 0h1m4 0h1m2 0h1M4 20.5h2m2 0h1m1 0h2m1 0h4m1 0h1m2 0h2m4 0h1m1 0h2M4 21.5h1m1 0h3m2 0h1m1 0h1m2 0h1m3 0h9m1 0h1m1 0h1M4 22.5h1m4 0h2m1 0h5m2 0h3m2 0h1m1 0h3m1 0h1M4 23.5h1m1 0h1m1 0h2m2 0h2m4 0h3m1 0h1m4 0h2m2 0h1M4 24.5h1m1 0h2m1 0h2m1 0h1m2 0h1m3 0h1m1 0h1m1 0h6m1 0h3M12 25.5h1m3 0h3m1 0h1m3 0h1m3 0h5M4 26.5h7m3 0h1m1 0h6m1 0h2m1 0h1m1 0h3M4 27.5h1m5 0h1m1 0h2m1 0h1m1 0h1m4 0h3m3 0h1M4 28.5h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h2m1 0h1m2 0h5m1 0h1M4 29.5h1m1 0h3m1 0h1m1 0h4m1 0h1m2 0h1m1 0h3m2 0h1m1 0h4M4 30.5h1m1 0h3m1 0h1m1 0h2m5 0h1m3 0h1m1 0h7M4 31.5h1m5 0h1m3 0h3m1 0h1m5 0h2m1 0h3m1 0h1M4 32.5h7m1 0h2m3 0h1m1 0h3m1 0h1m3 0h1m2 0h1"
      />
    </svg>
  );
}

function PuzzlePage({ puzzle, index }: { puzzle: PrintPuzzle; index: number }) {
  const hintSet = new Set(puzzle.hints.map(([r, c]) => `${r}-${c}`));

  return (
    <div className="print-page">
      <div className="print-content">
        <div className="print-header">
          <h1>Music Magic Square</h1>
          <p className="print-subtitle">Puzzle #{index + 1}</p>
        </div>

        <div className="print-instructions">
          <div className="print-instructions-row">
            <div className="print-instructions-text">
              <p>
                Fill each cell with a number from <strong>1 to 10</strong>.
                Each number represents a <strong>musical note duration</strong> measured
                in sixteenth notes. Every <strong>row</strong>, <strong>column</strong>,
                and <strong>diagonal</strong> must add up to exactly <strong>16</strong> &mdash;
                that&rsquo;s one full bar of music! Each line needs <strong>4 different values</strong>.
              </p>
              <p>
                Scan the QR code to learn more about magic squares and musical
                note durations, and to play your solution as music!
              </p>
            </div>
            <div className="print-qr">
              <QRCode size={100} />
            </div>
          </div>
        </div>

        <div className="print-grid-section">
          <div className="print-grid">
            {puzzle.grid.map((row, ri) =>
              row.map((val, ci) => {
                const isHint = hintSet.has(`${ri}-${ci}`);
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={`print-cell ${isHint ? 'print-hint' : ''}`}
                  >
                    {isHint ? val : ''}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="print-footer">
          <div className="print-credits">
            By Erisha | Grade 2 | Room 5
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintPuzzles() {
  return (
    <div className="print-puzzles">
      <div className="print-controls no-print">
        <p>This page contains {PUZZLES.length} printable puzzles. Use your browser's print function (Ctrl/Cmd+P) to print.</p>
        <button className="btn-primary" onClick={() => window.print()}>
          Print Puzzles
        </button>
      </div>
      {PUZZLES.map((puzzle, i) => (
        <PuzzlePage key={i} puzzle={puzzle} index={i} />
      ))}
    </div>
  );
}
