import { type Bar, PITCH_NAMES } from '../types';

interface BarDisplayProps {
  bars: Bar[];
  activeBar: number;
  activeNote: number;
}

export default function BarDisplay({ bars, activeBar, activeNote }: BarDisplayProps) {
  return (
    <div className="bar-display">
      <h3>10 Bars</h3>
      <div className="bars-list">
        {bars.map((bar, bi) => (
          <div key={bi} className={`bar-item ${bi === activeBar ? 'active' : ''}`}>
            <span className="bar-label">{bar.label}</span>
            <div className="bar-notes">
              {bar.cells.map((cell, ni) => (
                <span
                  key={ni}
                  className={`bar-note ${bi === activeBar && ni === activeNote ? 'playing' : ''}`}
                >
                  {cell.note === 'rest' ? '-' : PITCH_NAMES[cell.pitch] ?? '?'}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
