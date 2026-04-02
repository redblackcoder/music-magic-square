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
    <div className="playback-row">
      <button
        className={`btn-play ${isPlaying ? 'playing' : ''}`}
        onClick={isPlaying ? onStop : onPlay}
      >
        {isPlaying ? '\u25A0' : '\u25B6'}
      </button>

      <div className="bpm-vertical">
        <span className="bpm-value">{bpm}</span>
        <input
          type="range"
          min={30}
          max={180}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className="bpm-slider-v"
        />
        <span className="bpm-label">BPM</span>
      </div>
    </div>
  );
}
