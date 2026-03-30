import { useState, useCallback, useRef } from 'react';
import Camera from './components/Camera';
import GridEditor from './components/GridEditor';
import StaffDisplay from './components/StaffDisplay';
import PlaybackControls from './components/PlaybackControls';
import QRShare from './components/QRShare';
import { createDefaultGrid, extractBars, updateCellNote } from './gridLogic';
import { playBars, stopPlayback } from './audioEngine';
import type { MusicGrid, NoteType } from './types';
import { DEFAULT_PITCHES } from './types';
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
  const cancelRef = useRef<(() => void) | null>(null);

  const bars = extractBars(grid);

  const handleCellChange = useCallback((row: number, col: number, note: NoteType) => {
    setGrid((g) => updateCellNote(g, row, col, note));
  }, []);

  const handleCapture = useCallback((notes: NoteType[][]) => {
    setGrid(() =>
      notes.map((row, ri) =>
        row.map((note, ci) => ({
          row: ri,
          col: ci,
          note,
          pitch: DEFAULT_PITCHES[ri][ci],
        }))
      )
    );
    setView('main');
  }, []);

  const handlePlay = useCallback(async () => {
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
  }, [bars, bpm]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    stopPlayback();
    setIsPlaying(false);
    setActiveBar(-1);
    setActiveNote(-1);
  }, []);

  const handleRandomize = useCallback(() => {
    const noteTypes: NoteType[] = ['quarter', 'half', 'whole', 'eighth', 'rest'];
    setGrid(
      Array.from({ length: 4 }, (_, ri) =>
        Array.from({ length: 4 }, (_, ci) => ({
          row: ri,
          col: ci,
          note: noteTypes[Math.floor(Math.random() * noteTypes.length)],
          pitch: DEFAULT_PITCHES[ri][ci],
        }))
      )
    );
  }, []);

  if (view === 'camera') {
    return <Camera onCapture={handleCapture} onClose={() => setView('main')} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Music Magic Square</h1>
        <p className="subtitle">Draw a 4x4 grid of notes, hear 10 bars of music</p>
      </header>

      <div className="actions">
        <button className="btn-primary" onClick={() => setView('camera')}>
          Scan Grid
        </button>
        <button className="btn-secondary" onClick={handleRandomize}>
          Randomize
        </button>
      </div>

      <GridEditor
        grid={grid}
        onCellChange={handleCellChange}
        activeBar={activeBar}
        activeNote={activeNote}
      />

      <PlaybackControls
        isPlaying={isPlaying}
        bpm={bpm}
        onPlay={handlePlay}
        onStop={handleStop}
        onBpmChange={setBpm}
      />

      <StaffDisplay bars={bars} activeBar={activeBar} activeNote={activeNote} />

      <footer className="app-footer">
        <button className="btn-share" onClick={() => setShowQR(true)}>
          Share App
        </button>
        <p>
          Rows 1-4 &rarr; Bars 1-4 | Cols 1-4 &rarr; Bars 5-8 | Diagonals &rarr; Bars 9-10
        </p>
      </footer>

      <QRShare visible={showQR} onClose={() => setShowQR(false)} />
    </div>
  );
}

export default App;
