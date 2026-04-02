import { DUR_SYMBOL, REST_SYMBOL, GCLEF_CHAR } from '../types';

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

/** Render a small magic square grid */
function MiniGrid({ values, sum, label }: { values: number[][]; sum: number; label: string }) {
  const n = values.length;
  return (
    <div className="edu-grid-example">
      <div className={`edu-mini-grid edu-mini-grid-${n}`}>
        {values.flat().map((v, i) => (
          <span key={i} className="edu-mini-cell">{v}</span>
        ))}
      </div>
      <p className="edu-caption">
        <strong>{label}</strong> &mdash; every line = <strong>{sum}</strong>
      </p>
    </div>
  );
}

/** SVG staff lines for visual reference */
function StaffDiagram() {
  const lineY = [20, 30, 40, 50, 60];
  return (
    <svg viewBox="0 0 200 80" width="200" height="80" className="edu-staff-svg">
      {lineY.map((y, i) => (
        <line key={i} x1="10" x2="190" y1={y} y2={y} stroke="rgba(168,178,209,0.5)" strokeWidth="1" />
      ))}
      <text x="20" y="52" fill="rgba(168,178,209,0.6)" fontFamily="Bravura, serif" fontSize="30" textAnchor="middle">
        {GCLEF_CHAR}
      </text>
      <text x="60" y="55" fill="var(--text-bright)" fontFamily="Bravura, serif" fontSize="22">
        {DUR_SYMBOL['1/2'].char}
      </text>
      <text x="90" y="45" fill="var(--text-bright)" fontFamily="Bravura, serif" fontSize="22">
        {DUR_SYMBOL['1/4'].char}
      </text>
      <text x="120" y="35" fill="var(--text-bright)" fontFamily="Bravura, serif" fontSize="22">
        {DUR_SYMBOL['1/8'].char}
      </text>
      <text x="150" y="25" fill="var(--text-bright)" fontFamily="Bravura, serif" fontSize="22">
        {DUR_SYMBOL['1/16'].char}
      </text>
      <line x1="180" x2="180" y1="20" y2="60" stroke="rgba(168,178,209,0.5)" strokeWidth="1.5" />
    </svg>
  );
}

export default function DetailsPage() {
  return (
    <div className="edu-page">
      {/* ══════════ PART A: MAGIC SQUARES ══════════ */}
      <h2 className="edu-part-title">Magic Squares</h2>

      <section className="edu-card">
        <h3>The Lo Shu Square</h3>
        <p>
          Over <strong>2,000 years ago</strong> in ancient China, legend says a magical turtle
          emerged from a river with a strange pattern on its shell. The pattern was a
          3&times;3 grid of numbers &mdash; the <strong>Lo Shu</strong> square, one of the oldest
          mathematical puzzles in history.
        </p>
        <MiniGrid
          values={[[2,7,6],[9,5,1],[4,3,8]]}
          sum={15}
          label="Lo Shu Square (~190 BCE)"
        />
      </section>

      <section className="edu-card">
        <h3>D&uuml;rer's Magic Square</h3>
        <p>
          In <strong>1514</strong>, German artist <em>Albrecht D&uuml;rer</em> hid a 4&times;4
          magic square in his famous engraving <em>Melencolia I</em>. Look closely at the
          bottom row &mdash; the middle two numbers spell out <strong>15-14</strong>, the year
          he made it!
        </p>
        <MiniGrid
          values={[[16,3,2,13],[5,10,11,8],[9,6,7,12],[4,15,14,1]]}
          sum={34}
          label="D&uuml;rer's Square (1514)"
        />
      </section>

      <section className="edu-card">
        <h3>The Magic Constant</h3>
        <p>
          For a <strong>normal</strong> magic square (using numbers 1 to n&sup2;), the magic
          sum is always:
        </p>
        <div className="edu-formula">
          M = n(n&sup2; + 1) / 2
        </div>
        <div className="edu-formula-examples">
          <span>3&times;3: M = <strong>15</strong></span>
          <span>4&times;4: M = <strong>34</strong></span>
          <span>5&times;5: M = <strong>65</strong></span>
        </div>
        <p className="edu-note-sm">
          Our puzzle uses values 1&ndash;10 (not 1&ndash;16), so the magic sum is <strong>16</strong> instead of 34.
        </p>
      </section>

      <section className="edu-card">
        <h3>Types of Magic Squares</h3>
        <dl className="edu-def-list">
          <dt>Normal</dt>
          <dd>Uses consecutive integers 1 through n&sup2;.</dd>
          <dt>Pandiagonal</dt>
          <dd>Even the &ldquo;broken&rdquo; diagonals (wrapping around) sum to the magic constant. Much harder to construct!</dd>
          <dt>Associative</dt>
          <dd>Pairs of numbers symmetric about the center always add to the same value (n&sup2; + 1).</dd>
        </dl>
      </section>

      <section className="edu-card">
        <h3>Fun Facts</h3>
        <ul className="edu-fun-facts">
          <li>In medieval times, magic squares were engraved on amulets to ward off illness.</li>
          <li>Islamic mathematicians created magic squares as early as the 7th century.</li>
          <li>Benjamin Franklin spent hours creating elaborate magic squares for fun.</li>
          <li>There are <strong>880</strong> distinct normal 4&times;4 magic squares (ignoring rotations and reflections).</li>
        </ul>
      </section>

      {/* ══════════ PART B: MUSIC THEORY ══════════ */}
      <h2 className="edu-part-title">Music Theory Basics</h2>

      <section className="edu-card">
        <h3>Notes &amp; Duration</h3>
        <p>
          A <strong>note</strong> is a sound that lasts for a specific amount of time.
          The shape of the note tells you <em>how long</em> to play it:
        </p>
        <div className="edu-note-visual">
          {([
            { dur: '1/2' as const, name: 'Half', beats: '2 beats' },
            { dur: '1/4' as const, name: 'Quarter', beats: '1 beat' },
            { dur: '1/8' as const, name: 'Eighth', beats: '1/2 beat' },
            { dur: '1/16' as const, name: 'Sixteenth', beats: '1/4 beat' },
          ]).map(({ dur, name, beats }) => (
            <div key={dur} className="edu-note-card">
              <B char={DUR_SYMBOL[dur].char} size={36} dy={8} />
              <strong>{name}</strong>
              <span className="edu-dim">{beats}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="edu-card">
        <h3>Rests &mdash; The Sound of Silence</h3>
        <p>
          Every note has a matching <strong>rest</strong> symbol. A rest means
          &ldquo;stay quiet for this long.&rdquo; Silence is just as important as sound in music!
        </p>
        <div className="edu-note-visual">
          {([
            { dur: '1/2' as const, name: 'Half rest' },
            { dur: '1/4' as const, name: 'Quarter rest' },
            { dur: '1/8' as const, name: 'Eighth rest' },
            { dur: '1/16' as const, name: '16th rest' },
          ]).map(({ dur, name }) => (
            <div key={dur} className="edu-note-card">
              <B char={REST_SYMBOL[dur].char} size={28} />
              <span className="edu-dim">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="edu-card">
        <h3>Pitch &mdash; High and Low</h3>
        <p>
          <strong>Pitch</strong> is how high or low a note sounds. It depends on how fast
          the sound vibrates (the <em>frequency</em>). In written music, higher notes sit
          higher on the <strong>staff</strong> &mdash; the five horizontal lines:
        </p>
        <div className="edu-staff-diagram">
          <StaffDiagram />
          <p className="edu-caption">
            A treble clef staff with four notes &mdash; from long (left) to short (right).
          </p>
        </div>
      </section>

      <section className="edu-card">
        <h3>Time Signature &amp; Bars</h3>
        <p>
          Music is divided into equal chunks of time called <strong>bars</strong> (or measures),
          separated by vertical lines on the staff.
        </p>
        <p>
          The <strong>time signature</strong> tells you how many beats fit in each bar.
          In <strong>4/4 time</strong> (the most common):
        </p>
        <ul>
          <li><strong>4</strong> quarter-note beats per bar</li>
          <li>= <strong>8</strong> eighth notes per bar</li>
          <li>= <strong>16</strong> sixteenth notes per bar</li>
        </ul>
        <p>
          That&apos;s why our magic square rows must sum to <strong>16</strong> &mdash;
          each row fills exactly one bar!
        </p>
      </section>

      <section className="edu-card">
        <h3>Tied Notes</h3>
        <p>
          Sometimes you need a duration that doesn&apos;t match any single note.
          A <strong>tie</strong> connects two (or three) notes into one longer sound:
        </p>
        <div className="edu-tied-examples">
          <div className="edu-tied-demo">
            <span className="edu-tied-group">
              <span className="edu-tied-notes-row">
                <B char={DUR_SYMBOL['1/4'].char} size={24} dy={5} />
                <B char={DUR_SYMBOL['1/8'].char} size={24} dy={5} />
              </span>
              <svg className="edu-tie-arc" viewBox="0 0 36 10" width="36" height="8">
                <path d="M4 2 Q18 10 32 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span>= 4 + 2 = <strong>6</strong> sixteenths</span>
          </div>
          <div className="edu-tied-demo">
            <span className="edu-tied-group">
              <span className="edu-tied-notes-row">
                <B char={DUR_SYMBOL['1/2'].char} size={24} dy={5} />
                <B char={DUR_SYMBOL['1/4'].char} size={24} dy={5} />
              </span>
              <svg className="edu-tie-arc" viewBox="0 0 36 10" width="36" height="8">
                <path d="M4 2 Q18 10 32 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span>= 8 + 4 = <strong>12</strong> sixteenths</span>
          </div>
          <div className="edu-tied-demo">
            <span className="edu-tied-group">
              <span className="edu-tied-notes-row">
                <B char={DUR_SYMBOL['1/4'].char} size={24} dy={5} />
                <B char={DUR_SYMBOL['1/8'].char} size={24} dy={5} />
                <B char={DUR_SYMBOL['1/16'].char} size={24} dy={5} />
              </span>
              <svg className="edu-tie-arc" viewBox="0 0 50 10" width="50" height="8">
                <path d="M4 2 Q14 10 24 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M26 2 Q36 10 46 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span>= 4 + 2 + 1 = <strong>7</strong> sixteenths</span>
          </div>
        </div>
      </section>
    </div>
  );
}
