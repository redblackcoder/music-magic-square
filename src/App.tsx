import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Camera from './components/Camera';
import OnlineSolver from './components/OnlineSolver';
import TabBar, { type Tab } from './components/TabBar';
import LearnPage from './components/LearnPage';
import DetailsPage from './components/DetailsPage';
import GridEditor from './components/GridEditor';
import StaffDisplay from './components/StaffDisplay';
import PlaybackControls from './components/PlaybackControls';
import QRShare from './components/QRShare';
import { createEmptyGrid, extractBars, updateCellValue, validateMagicSquare } from './gridLogic';
import { playBars, stopPlayback } from './audioEngine';
import type { MusicGrid, CellValue } from './types';
import { MELODY_PRESETS } from './types';
import './App.css';

function App() {
  const [tab, setTab] = useState<Tab>('learn');
  const [showCamera, setShowCamera] = useState(false);
  const [showSolver, setShowSolver] = useState(false);
  const [grid, setGrid] = useState<MusicGrid>(() => createEmptyGrid(MELODY_PRESETS[0].pitches));
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

  const handleGridValues = useCallback((values: CellValue[][]) => {
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

  return (
    <>
      {showCamera && (
        <Camera onCapture={(v) => { handleGridValues(v); setShowCamera(false); }} onClose={() => setShowCamera(false)} />
      )}
      {showSolver && (
        <OnlineSolver onCapture={(v) => { handleGridValues(v); setShowSolver(false); }} onClose={() => setShowSolver(false)} />
      )}

      <div className="app">
        <header className="app-header">
          <h1>Music Magic Square</h1>
          <p className="subtitle">Each row, column &amp; diagonal = 1 bar in 4/4 time</p>
        </header>

        <TabBar active={tab} onChange={setTab} />

        {tab === 'learn' && <LearnPage />}

        {tab === 'solve' && (
          <>
            <div className="actions">
              <button className="btn-primary" onClick={() => setShowCamera(true)}>
                Scan Grid
              </button>
              <button className="btn-secondary" onClick={() => setShowSolver(true)}>
                Solve Online
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
          </>
        )}

        {tab === 'details' && <DetailsPage />}

        <footer className="app-footer">
          <button className="btn-share" onClick={() => setShowQR(true)}>
            Share App
          </button>
        </footer>

        <QRShare visible={showQR} onClose={() => setShowQR(false)} />
      </div>
    </>
  );
}

export default App;
