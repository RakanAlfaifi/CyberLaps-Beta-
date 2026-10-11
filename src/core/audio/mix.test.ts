import { describe, expect, it } from "vitest";
import { DEFAULT_AUDIO_SETTINGS } from "@/core/state/audioStore";
import type { AudioSettings } from "@/types/audio";
import { effectiveSfxGain, mixFor } from "./mix";

const settings = (over: Partial<AudioSettings>): AudioSettings => ({ ...DEFAULT_AUDIO_SETTINGS, ...over });

describe("audio mix", () => {
  it("mute silences effects, the ambient pad and a file track together", () => {
    const mix = mixFor(settings({ muted: true, masterVolume: 1, musicVolume: 1, sfxVolume: 1 }));
    expect(mix.master).toBe(0);
    expect(mix.track).toBe(0);
    expect(effectiveSfxGain(settings({ muted: true }))).toBe(0);
  });

  it("master volume scales music and effects alike", () => {
    const full = settings({ masterVolume: 1, musicVolume: 1, sfxVolume: 1 });
    const half = settings({ masterVolume: 0.5, musicVolume: 1, sfxVolume: 1 });
    expect(mixFor(full).track).toBe(1);
    expect(mixFor(half).track).toBeCloseTo(0.25);
    expect(effectiveSfxGain(half)).toBeCloseTo(0.25);
  });

  it("master at zero skips effects even when their own slider is up", () => {
    expect(effectiveSfxGain(settings({ masterVolume: 0, sfxVolume: 1 }))).toBe(0);
  });

  it("clamps out-of-range values", () => {
    expect(mixFor(settings({ masterVolume: 2, musicVolume: -1 }))).toMatchObject({ master: 1, music: 0, track: 0 });
  });
});
