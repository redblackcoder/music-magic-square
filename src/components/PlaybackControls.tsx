interface PlaybackControlsProps {
  isPlaying: boolean;
  bpm: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
}

export default function PlaybackControls({
  isPlaying,
  bpm,
  onPlay,
  onStop,
  onBpmChange,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      <button
        className={`btn-play ${isPlaying ? 'playing' : ''}`}
        onClick={isPlaying ? onStop : onPlay}
      >
        {isPlaying ? '\u25A0 Stop' : '\u25B6 Play'}
      </button>
      <div className="bpm-control">
        <label>BPM</label>
        <input
          type="range"
          min={60}
          max={240}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
        />
        <span className="bpm-value">{bpm}</span>
      </div>
    </div>
  );
}
