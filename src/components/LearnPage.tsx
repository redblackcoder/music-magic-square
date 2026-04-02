import { DUR_SYMBOL, REST_SYMBOL } from '../types';

/** Inline Bravura glyph */
function B({ char, size = 28, dy = 0 }: { char: string; size?: number; dy?: number }) {
  return (
    <span
      className="bravura"
      style={{ fontSize: size, transform: `translateY(${dy}px)`, display: 'inline-block' }}
    >
      {char}
    </span>
  );
}

export default function LearnPage() {
  return (
    <div className="edu-page">
      {/* ── Section 1: Magic Squares ── */}
      <section className="edu-card">
        <h2>What is a Magic Square?</h2>
        <p>
          A <strong>magic square</strong> is a grid of numbers where every row, column,
          and diagonal adds up to the <em>same total</em>.
        </p>

        <div className="edu-grid-example">
          <div className="edu-mini-grid lo-shu">
            {[2,7,6, 9,5,1, 4,3,8].map((n, i) => (
              <span key={i} className="edu-mini-cell">{n}</span>
            ))}
          </div>
          <p className="edu-caption">
            The <strong>Lo Shu</strong> square (ancient China).
            <br />Every line = <strong>15</strong>.
          </p>
        </div>

        <p>
          In <strong>this puzzle</strong>, each cell is a musical note duration measured in
          sixteenths. Every row, column, and diagonal must sum to <strong>16 sixteenths</strong> = 1 whole bar of music.
          Each line must use <strong>4 different</strong> values.
        </p>
      </section>

      {/* ── Section 2: Note Durations ── */}
      <section className="edu-card">
        <h2>Note Durations</h2>
        <p>
          Each note has a <strong>duration</strong> &mdash; how long it sounds.
          We measure everything in <em>sixteenth notes</em>:
        </p>

        <div className="edu-note-table">
          <div className="edu-note-row edu-note-header">
            <span>Symbol</span>
            <span>Name</span>
            <span>Fraction</span>
            <span>Sixteenths</span>
          </div>
          {([
            { dur: '1/2' as const, name: 'Half note', sixteenths: 8 },
            { dur: '1/4' as const, name: 'Quarter note', sixteenths: 4 },
            { dur: '1/8' as const, name: 'Eighth note', sixteenths: 2 },
            { dur: '1/16' as const, name: 'Sixteenth note', sixteenths: 1 },
          ]).map(({ dur, name, sixteenths }) => (
            <div key={dur} className="edu-note-row">
              <span><B char={DUR_SYMBOL[dur].char} size={26} dy={6} /></span>
              <span>{name}</span>
              <span className="mono">{dur}</span>
              <span className="mono">{sixteenths}</span>
            </div>
          ))}
        </div>

        <div className="edu-tied-example">
          <h3>Tied Notes</h3>
          <p>
            Two notes can be <strong>tied together</strong> to make longer durations:
          </p>
          <div className="edu-tied-row">
            <span className="edu-tied-group">
              <span className="edu-tied-notes-row">
                <B char={DUR_SYMBOL['1/4'].char} size={22} dy={5} />
                <B char={DUR_SYMBOL['1/8'].char} size={22} dy={5} />
              </span>
              <svg className="edu-tie-arc" viewBox="0 0 36 10" width="36" height="8">
                <path d="M4 2 Q18 10 32 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span>= 4 + 2 = <strong>6</strong> sixteenths</span>
          </div>
          <div className="edu-tied-row">
            <span className="edu-tied-group">
              <span className="edu-tied-notes-row">
                <B char={DUR_SYMBOL['1/2'].char} size={22} dy={5} />
                <B char={DUR_SYMBOL['1/16'].char} size={22} dy={5} />
              </span>
              <svg className="edu-tie-arc" viewBox="0 0 36 10" width="36" height="8">
                <path d="M4 2 Q18 10 32 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span>= 8 + 1 = <strong>9</strong> sixteenths</span>
          </div>
          <p className="edu-note-sm">
            Valid cell values: <strong>1, 2, 3, 4, 5, 6, 7, 8, 9, 10</strong>
          </p>
        </div>
      </section>

      {/* ── Section 3: Bars ── */}
      <section className="edu-card">
        <h2>What is a Bar?</h2>
        <p>
          Music is divided into equal chunks of time called <strong>bars</strong> (or measures).
          In <strong>4/4 time</strong>, each bar holds <strong>16 sixteenth notes</strong>.
        </p>

        <div className="edu-bar-example">
          <div className="edu-bar-fill">
            {[
              { dur: '1/2' as const, label: '8', w: 50 },
              { dur: '1/4' as const, label: '4', w: 25 },
              { dur: '1/8' as const, label: '2', w: 12.5 },
              { dur: '1/8' as const, label: '2', w: 12.5 },
            ].map((n, i) => (
              <div key={i} className="edu-bar-segment" style={{ flex: n.w }}>
                <B char={DUR_SYMBOL[n.dur].char} size={20} dy={4} />
                <span className="edu-bar-label">{n.label}</span>
              </div>
            ))}
          </div>
          <p className="edu-caption">8 + 4 + 2 + 2 = <strong>16</strong> sixteenths = 1 bar</p>
        </div>
      </section>

      {/* ── Section 4: How to Solve ── */}
      <section className="edu-card">
        <h2>How to Solve</h2>
        <ol className="edu-steps">
          <li>
            <strong>Draw</strong> a 4&times;4 grid on paper.
          </li>
          <li>
            <strong>Fill</strong> each cell with a number from 1 to 10.
          </li>
          <li>
            Make every <strong>row</strong>, <strong>column</strong>, and <strong>diagonal</strong> sum
            to exactly <strong>16</strong>.
          </li>
          <li>
            Each line must have <strong>4 different values</strong> (no repeats).
          </li>
          <li>
            <strong>Scan</strong> your grid with the app to hear it as music!
          </li>
        </ol>
      </section>

      {/* ── Section 5: Rests ── */}
      <section className="edu-card">
        <h2>Rests</h2>
        <p>
          Silence has duration too! A <strong>rest</strong> tells the musician
          to stay quiet for a specific length of time.
        </p>
        <div className="edu-note-table edu-note-table-sm">
          <div className="edu-note-row edu-note-header">
            <span>Symbol</span>
            <span>Name</span>
            <span>Sixteenths</span>
          </div>
          {([
            { dur: '1/2' as const, name: 'Half rest', sixteenths: 8 },
            { dur: '1/4' as const, name: 'Quarter rest', sixteenths: 4 },
            { dur: '1/8' as const, name: 'Eighth rest', sixteenths: 2 },
            { dur: '1/16' as const, name: 'Sixteenth rest', sixteenths: 1 },
          ]).map(({ dur, name, sixteenths }) => (
            <div key={dur} className="edu-note-row">
              <span><B char={REST_SYMBOL[dur].char} size={22} /></span>
              <span>{name}</span>
              <span className="mono">{sixteenths}</span>
            </div>
          ))}
        </div>
        <p className="edu-note-sm">
          Long-press any cell in the grid to toggle it to a rest.
        </p>
      </section>
    </div>
  );
}
