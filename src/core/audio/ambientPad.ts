export interface AmbientPad {
  start: (fadeSec: number) => void;
  stop: (fadeSec: number) => void;
}

/**
 * Bass note, then the soft chord tones above it: Cmaj9, Am9, Fmaj7, G6sus2.
 * All in C major, so any chord can follow any other without tension.
 */
const CHORDS: readonly (readonly number[])[] = [
  [65.41, 196.0, 246.94, 293.66, 329.63],
  [55.0, 164.81, 196.0, 246.94, 261.63],
  [87.31, 174.61, 220.0, 261.63, 329.63],
  [98.0, 146.83, 196.0, 220.0, 293.66],
];
/** C major pentatonic, two octaves up: the rare "glint" notes. */
const GLINTS: readonly number[] = [523.25, 587.33, 659.25, 783.99, 880.0];

/** Each chord holds this long; the next one swells in while it fades out. */
const CHORD_SEC = 12;
const SWELL_SEC = 5;
const LOOKAHEAD_SEC = 2;
const TICK_MS = 500;

const OUTPUT_LEVEL = 0.32;
const BASS_LEVEL = 0.1;
const TONE_LEVEL = 0.045;
const VOICE_DETUNE_CENTS = 5;
const GLINT_CHANCE = 0.55;
const GLINT_LEVEL = 0.028;
const GLINT_DECAY_SEC = 3.2;

const FILTER_BASE_HZ = 850;
const FILTER_LFO_HZ = 0.03;
const FILTER_LFO_DEPTH_HZ = 220;
const ECHO_SEC = 0.48;
const ECHO_FEEDBACK = 0.3;
const ECHO_SEND = 0.22;

interface Graph {
  output: GainNode;
  /** Chord voices feed this (it goes through the low-pass filter). */
  pad: AudioNode;
  /** Glints feed this (dry, plus the echo). */
  glint: AudioNode;
  lfo: OscillatorNode;
  voices: Set<AudioScheduledSourceNode>;
  timer: ReturnType<typeof setInterval> | null;
  nextAt: number;
  chord: number;
}

/**
 * Synthesized focus music: a slow, warm chord progression of soft sine and triangle
 * voices behind a gently breathing low-pass filter, with an occasional quiet high note
 * and a soft echo. Chords are scheduled a little ahead on the audio clock, so a
 * suspended context (hidden tab) simply pauses the progression.
 */
export function createAmbientPad(ctx: AudioContext, destination: AudioNode): AmbientPad {
  let active: Graph | null = null;

  function build(): Graph {
    const output = ctx.createGain();
    output.gain.value = 0;
    output.connect(destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = FILTER_BASE_HZ;
    filter.Q.value = 0.5;
    filter.connect(output);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = FILTER_LFO_HZ;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = FILTER_LFO_DEPTH_HZ;
    lfo.connect(lfoDepth).connect(filter.frequency);

    const echoSend = ctx.createGain();
    echoSend.gain.value = ECHO_SEND;
    const echo = ctx.createDelay(1);
    echo.delayTime.value = ECHO_SEC;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 1800;
    const feedback = ctx.createGain();
    feedback.gain.value = ECHO_FEEDBACK;
    echoSend.connect(echo);
    echo.connect(echoTone);
    echoTone.connect(feedback).connect(echo);
    echoTone.connect(output);
    filter.connect(echoSend);

    const glint = ctx.createGain();
    glint.connect(output);
    glint.connect(echoSend);

    return { output, pad: filter, glint, lfo, voices: new Set(), timer: null, nextAt: 0, chord: 0 };
  }

  function voice(g: Graph, type: OscillatorType, freq: number, detune: number, level: number, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const env = ctx.createGain();
    const end = t + CHORD_SEC + SWELL_SEC;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + SWELL_SEC);
    env.gain.setValueAtTime(level, t + CHORD_SEC);
    env.gain.linearRampToValueAtTime(0, end);
    osc.connect(env).connect(g.pad);
    track(g, osc, env, t, end);
  }

  function glintNote(g: Graph, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = GLINTS[Math.floor(Math.random() * GLINTS.length)];
    const env = ctx.createGain();
    const end = t + GLINT_DECAY_SEC;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(GLINT_LEVEL, t + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env).connect(g.glint);
    track(g, osc, env, t, end);
  }

  function track(g: Graph, osc: OscillatorNode, env: GainNode, t: number, end: number): void {
    g.voices.add(osc);
    osc.onended = () => {
      g.voices.delete(osc);
      env.disconnect();
    };
    osc.start(t);
    osc.stop(end + 0.05);
  }

  function playChord(g: Graph, t: number): void {
    const [bass, ...tones] = CHORDS[g.chord % CHORDS.length];
    g.chord++;
    voice(g, "sine", bass, 0, BASS_LEVEL, t);
    for (const freq of tones) {
      voice(g, "sine", freq, -VOICE_DETUNE_CENTS, TONE_LEVEL, t);
      voice(g, "triangle", freq, VOICE_DETUNE_CENTS, TONE_LEVEL * 0.6, t);
    }
    if (Math.random() < GLINT_CHANCE) glintNote(g, t + SWELL_SEC + Math.random() * (CHORD_SEC - SWELL_SEC));
  }

  function tick(g: Graph): void {
    if (active !== g || ctx.state !== "running") return;
    if (g.nextAt < ctx.currentTime) g.nextAt = ctx.currentTime + 0.05;
    while (g.nextAt < ctx.currentTime + LOOKAHEAD_SEC) {
      playChord(g, g.nextAt);
      g.nextAt += CHORD_SEC;
    }
  }

  return {
    start(fadeSec) {
      if (active) return;
      const g = build();
      active = g;
      const t = ctx.currentTime;
      g.lfo.start(t);
      g.output.gain.setValueAtTime(0, t);
      g.output.gain.linearRampToValueAtTime(OUTPUT_LEVEL, t + fadeSec);
      g.nextAt = t + 0.05;
      g.chord = Math.floor(Math.random() * CHORDS.length);
      g.timer = setInterval(() => tick(g), TICK_MS);
      tick(g);
    },

    stop(fadeSec) {
      const g = active;
      if (!g) return;
      active = null;
      if (g.timer !== null) clearInterval(g.timer);
      const t = ctx.currentTime;
      const end = t + fadeSec + 0.1;
      g.output.gain.cancelScheduledValues(t);
      g.output.gain.setValueAtTime(g.output.gain.value, t);
      g.output.gain.linearRampToValueAtTime(0, t + fadeSec);
      for (const v of [...g.voices, g.lfo]) {
        try {
          v.stop(end);
        } catch {
          // Already stopped.
        }
      }
      g.lfo.onended = () => g.output.disconnect();
    },
  };
}
