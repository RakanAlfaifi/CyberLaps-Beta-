import type { SfxName } from "@/types/audio";

export interface SfxContext {
  ctx: AudioContext;
  out: AudioNode;
  /** AudioContext time at which the sound should start. */
  time: number;
  noise: AudioBuffer;
  pitch: number;
  gain: number;
}

export interface SfxRecipe {
  /** Calls closer together than this are dropped, so bursts never pile up. */
  minIntervalMs: number;
  play: (c: SfxContext) => void;
}

interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  q?: number;
}

interface ToneSpec {
  type: OscillatorType;
  freq: number;
  endFreq?: number;
  start?: number;
  duration: number;
  peak: number;
  attack?: number;
  detune?: number;
  filter?: FilterSpec;
}

interface NoiseSpec {
  start?: number;
  duration: number;
  peak: number;
  attack?: number;
  filter: FilterSpec;
}

function createFilter(ctx: AudioContext, spec: FilterSpec): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = spec.type;
  f.frequency.value = spec.freq;
  f.Q.value = spec.q ?? 0.7;
  return f;
}

/** Exponential ramps cannot touch 0, so the envelope floors at a tiny value. */
function createEnvelope(ctx: AudioContext, t0: number, t1: number, peak: number, attack: number) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t1);
  return env;
}

function tone(c: SfxContext, s: ToneSpec): void {
  const { ctx } = c;
  const t0 = c.time + (s.start ?? 0);
  const t1 = t0 + s.duration;

  const osc = ctx.createOscillator();
  osc.type = s.type;
  osc.frequency.setValueAtTime(s.freq * c.pitch, t0);
  if (s.endFreq) osc.frequency.exponentialRampToValueAtTime(s.endFreq * c.pitch, t1);
  if (s.detune) osc.detune.value = s.detune;

  const env = createEnvelope(ctx, t0, t1, s.peak * c.gain, s.attack ?? 0.008);
  let head: AudioNode = osc;
  if (s.filter) {
    const f = createFilter(ctx, s.filter);
    osc.connect(f);
    head = f;
  }
  head.connect(env);
  env.connect(c.out);

  osc.start(t0);
  osc.stop(t1 + 0.02);
  osc.onended = () => env.disconnect();
}

function noise(c: SfxContext, s: NoiseSpec): void {
  const { ctx } = c;
  const t0 = c.time + (s.start ?? 0);
  const t1 = t0 + s.duration;

  const src = ctx.createBufferSource();
  src.buffer = c.noise;
  const f = createFilter(ctx, s.filter);
  const env = createEnvelope(ctx, t0, t1, s.peak * c.gain, s.attack ?? 0.003);
  src.connect(f);
  f.connect(env);
  env.connect(c.out);

  const maxOffset = Math.max(0, c.noise.duration - s.duration - 0.01);
  src.start(t0, Math.random() * maxOffset);
  src.stop(t1 + 0.02);
  src.onended = () => env.disconnect();
}

/**
 * Every effect is short, quiet and pitched in C major so it sits on top of the
 * ambient pad instead of fighting it. Sines and low-passed triangles only: no buzz.
 */
export const SFX_RECIPES: Record<SfxName, SfxRecipe> = {
  // A soft "pip" as a packet leaves. Scans fire many, so it stays very quiet.
  packet: {
    minIntervalMs: 60,
    play: (c) =>
      tone(c, {
        type: "sine",
        freq: 659.25,
        endFreq: 783.99,
        duration: 0.09,
        peak: 0.06,
        filter: { type: "lowpass", freq: 1500 },
      }),
  },

  // Gentle two-note bell: a reply came back, a port is open.
  success: {
    minIntervalMs: 90,
    play: (c) => {
      tone(c, { type: "sine", freq: 783.99, duration: 0.35, peak: 0.075, attack: 0.01 });
      tone(c, { type: "sine", freq: 1046.5, start: 0.06, duration: 0.45, peak: 0.055, attack: 0.01 });
    },
  },

  // Soft, low "bonk": wrong target or no answer. Informative, never alarming.
  reject: {
    minIntervalMs: 150,
    play: (c) => {
      const filter: FilterSpec = { type: "lowpass", freq: 600 };
      tone(c, { type: "sine", freq: 220, endFreq: 165, duration: 0.18, peak: 0.07, attack: 0.012, filter });
      tone(c, { type: "triangle", freq: 196, endFreq: 147, duration: 0.16, peak: 0.025, attack: 0.012, filter });
    },
  },

  // Muted wooden tap: a TCP reset coming back.
  rst: {
    minIntervalMs: 80,
    play: (c) => {
      noise(c, { duration: 0.035, peak: 0.06, filter: { type: "bandpass", freq: 1200, q: 0.9 } });
      tone(c, { type: "sine", freq: 261.63, endFreq: 196, duration: 0.09, peak: 0.05 });
    },
  },

  // Barely-there tactile tick. Slight random color so typing does not sound robotic.
  keypress: {
    minIntervalMs: 25,
    play: (c) =>
      noise(c, {
        duration: 0.018,
        peak: 0.022,
        filter: { type: "bandpass", freq: 2600 + Math.random() * 900, q: 0.8 },
      }),
  },

  click: {
    minIntervalMs: 40,
    play: (c) => tone(c, { type: "sine", freq: 880, endFreq: 740, duration: 0.045, peak: 0.045, attack: 0.004 }),
  },

  modalOpen: {
    minIntervalMs: 120,
    play: (c) => {
      tone(c, { type: "sine", freq: 523.25, endFreq: 659.25, duration: 0.16, peak: 0.045, attack: 0.02 });
      tone(c, { type: "sine", freq: 783.99, start: 0.05, duration: 0.2, peak: 0.025, attack: 0.02 });
    },
  },

  modalClose: {
    minIntervalMs: 120,
    play: (c) => tone(c, { type: "sine", freq: 659.25, endFreq: 523.25, duration: 0.14, peak: 0.04, attack: 0.015 }),
  },

  // Unhurried rising C-major arpeggio with a soft shimmer.
  levelComplete: {
    minIntervalMs: 600,
    play: (c) => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        tone(c, { type: "sine", freq, start: i * 0.11, duration: 0.8, peak: 0.07, attack: 0.015 });
        tone(c, { type: "triangle", freq: freq * 2, start: i * 0.11, duration: 0.4, peak: 0.01, filter: { type: "lowpass", freq: 3000 } });
      });
    },
  },
};
