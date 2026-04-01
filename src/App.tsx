import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Camera from './components/Camera';
import GridEditor from './components/GridEditor';
import StaffDisplay from './components/StaffDisplay';
import PlaybackControls from './components/PlaybackControls';
import QRShare from './components/QRShare';
import { createDefaultGrid, extractBars, updateCellValue, validateMagicSquare } from './gridLogic';
import { playBars, stopPlayback } from './audioEngine';
import type { MusicGrid, CellValue } from './types';
import { DEFAULT_VALUES, MELODY_PRESETS } from './types';
import './App.css';

type View = 'main' | 'camera';

function App() {
  const [view, setView] = useState<View>('main');
  const [grid, setGrid] = useState<MusicGrid>(createDefaultGrid);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [activeBar, setActiveBar] = useState(-1);
  const [activeNote, setActiveNote] = useState(-1);
  const [showQR, setShowQR] = useState(false);
  const [melodyIndex, setMelodyIndex] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const melody = MELODY_PRESETS[melodyIndex];

  // Update cell pitches when melody preset changes
  useEffect(() => {
    setGrid((g) =>
      g.map((row, ri) =>
        row.map((cell, ci) => ({
          ...cell,
          pitch: melody.pitches[ri][ci],
        }))
      )
    );
  }, [melody]);

  const bars = extractBars(grid);
  const validation = useMemo(() => validateMagicSquare(grid), [grid]);

  const handleCellChange = useCallback((row: number, col: number, value: CellValue) => {
    setGrid((g) => updateCellValue(g, row, col, value));
  }, []);

  const handleCapture = useCallback((values: CellValue[][]) => {
    setGrid(() =>
      values.map((row, ri) =>
        row.map((value, ci) => ({
          row: ri,
          col: ci,
          value,
          pitch: melody.pitches[ri][ci],
        }))
      )
    );
    setView('main');
  }, [melody]);

  const handlePlay = useCallback(async () => {
    if (!validation.valid) return;
    setIsPlaying(true);
    setActiveBar(0);
    setActiveNote(-1);

    const cancel = await playBars(
      bars,
      bpm,
      (barIndex) => {
        if (barIndex === -1) {
          setIsPlaying(false);
          setActiveBar(-1);
          setActiveNote(-1);
        } else {
          setActiveBar(barIndex);
        }
      },
      (barIndex, noteIndex) => {
        setActiveBar(barIndex);
        setActiveNote(noteIndex);
      },
    );
    cancelRef.current = cancel;
  }, [bars, bpm, validation.valid]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    stopPlayback();
    setIsPlaying(false);
    setActiveBar(-1);
    setActiveNote(-1);
  }, []);

  const handleRandomize = useCallback(() => {
    const rowPerm = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const colPerm = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    setGrid(
      Array.from({ length: 4 }, (_, ri) =>
        Array.from({ length: 4 }, (_, ci) => ({
          row: ri,
          col: ci,
          value: DEFAULT_VALUES[rowPerm[ri]][colPerm[ci]],
          pitch: melody.pitches[ri][ci],
        }))
      )
    );
  }, [melody]);

  if (view === 'camera') {
    return <Camera onCapture={handleCapture} onClose={() => setView('main')} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Music Magic Square</h1>
        <p className="subtitle">Each row, column &amp; diagonal = 1 bar in 4/4 time</p>
      </header>

      <div className="actions">
        <button className="btn-primary" onClick={() => setView('camera')}>
          Scan Grid
        </button>
        <button className="btn-secondary" onClick={handleRandomize}>
          Randomize
        </button>
      </div>

      <div className="melody-selector">
        <label className="melody-label">Melody:</label>
        <select
          className="melody-select"
          value={melodyIndex}
          onChange={(e) => setMelodyIndex(Number(e.target.value))}
        >
          {MELODY_PRESETS.map((preset, i) => (
            <option key={i} value={i}>{preset.name}</option>
          ))}
        </select>
      </div>

      <GridEditor
        grid={grid}
        onCellChange={handleCellChange}
        activeBar={activeBar}
        activeNote={activeNote}
      />

      {/* Validation badge */}
      <div className={`validation ${validation.valid ? 'valid' : 'invalid'}`}>
        {validation.valid ? (
          <span>Valid magic square</span>
        ) : (
          <details>
            <summary>Invalid — {validation.errors.length} line(s) don't sum to 1 bar</summary>
            <ul>
              {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </details>
        )}
      </div>

      {/* Staff + BPM layout */}
      <div className="staff-bpm-row">
        <StaffDisplay bars={bars} activeBar={activeBar} activeNote={activeNote} />
        <PlaybackControls
          isPlaying={isPlaying}
          bpm={bpm}
          onPlay={handlePlay}
          onStop={handleStop}
          onBpmChange={setBpm}
        />
      </div>

      <footer className="app-footer">
        <button className="btn-share" onClick={() => setShowQR(true)}>
          Share App
        </button>
      </footer>

      <QRShare visible={showQR} onClose={() => setShowQR(false)} />
    </div>
  );
}

export default App;
