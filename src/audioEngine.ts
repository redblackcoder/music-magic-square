import * as Tone from 'tone';
import { type Bar, getCellBeats } from './types';

let synth: Tone.PolySynth | null = null;

function getSynth(): Tone.PolySynth {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    }).toDestination();
  }
  return synth;
}

/** Convert MIDI number to Tone.js note string */
function midiToNote(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = names[midi % 12];
  return `${name}${octave}`;
}

/** Play all 10 bars sequentially. Returns a cancel function. */
export async function playBars(
  bars: Bar[],
  bpm: number = 120,
  onBarStart?: (barIndex: number) => void,
  onNoteStart?: (barIndex: number, noteIndex: number) => void,
): Promise<() => void> {
  await Tone.start();
  const s = getSynth();

  Tone.getTransport().cancel();
  Tone.getTransport().bpm.value = bpm;
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;

  // Beat offset in quarter notes (since Tone BPM is in quarter notes per minute)
  let beatOffset = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const bar = bars[bi];
    const barBeatStart = beatOffset;

    Tone.getTransport().schedule(() => {
      onBarStart?.(bi);
    }, `0:0:${barBeatStart}`);

    for (let ni = 0; ni < bar.cells.length; ni++) {
      const cell = bar.cells[ni];
      // getCellBeats returns fraction of a whole note; multiply by 4 for quarter-note beats
      const durationInQuarters = getCellBeats(cell.value) * 4;
      const time = `0:0:${beatOffset}`;
      const note = midiToNote(cell.pitch);
      const noteDur = `0:0:${durationInQuarters}`;
      const capturedBi = bi;
      const capturedNi = ni;

      Tone.getTransport().schedule((t) => {
        onNoteStart?.(capturedBi, capturedNi);
        s.triggerAttackRelease(note, noteDur, t);
      }, time);

      beatOffset += durationInQuarters;
    }
  }

  // Schedule stop
  Tone.getTransport().schedule(() => {
    Tone.getTransport().stop();
    onBarStart?.(-1);
  }, `0:0:${beatOffset}`);

  Tone.getTransport().start();

  return () => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  };
}

export function stopPlayback() {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
}
