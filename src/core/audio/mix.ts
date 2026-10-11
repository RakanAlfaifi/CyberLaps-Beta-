import type { AudioSettings } from "@/types/audio";

/** Sliders are linear but hearing is not; squaring feels more natural. */
export const toGain = (v: number): number => {
  const c = Math.min(1, Math.max(0, v));
  return c * c;
};

export interface Mix {
  /** Master bus: every synth sound and the ambient pad pass through it. */
  master: number;
  music: number;
  sfx: number;
  /** A Howler file track plays outside the Web Audio graph, so it carries master × music itself. */
  track: number;
}

export function mixFor(settings: AudioSettings): Mix {
  const master = settings.muted ? 0 : toGain(settings.masterVolume);
  const music = toGain(settings.musicVolume);
  return { master, music, sfx: toGain(settings.sfxVolume), track: master * music };
}

/** What a sound effect would actually play at. Zero means skip it entirely. */
export const effectiveSfxGain = (settings: AudioSettings): number => {
  const mix = mixFor(settings);
  return mix.master * mix.sfx;
};
