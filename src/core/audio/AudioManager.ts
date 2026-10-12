import { Howl } from "howler";
import type { AudioSettings, SfxName, SfxOptions } from "@/types/audio";
import { createAmbientPad, type AmbientPad } from "./ambientPad";
import { DEFAULT_AUDIO_SETTINGS } from "./defaults";
import { effectiveSfxGain, mixFor } from "./mix";
import { SFX_RECIPES } from "./sfxRecipes";

const GAIN_RAMP_SEC = 0.12;
const MUSIC_FADE_SEC = 4;
const NOISE_BUFFER_SEC = 1;

type AudioContextCtor = typeof AudioContext;

/**
 * Single owner of all lab audio.
 *
 * Graph:  sfxBus ──┐
 *                  ├─> master ─> compressor ─> speakers
 *       musicBus ──┘
 *
 * Music defaults to a synthesized ambient pad. A file track can be set with
 * setMusicTrack(); it plays through Howler and falls back to the pad on error.
 * Howler has its own output, so the track's volume carries master × music itself.
 *
 * Browsers block audio until the user interacts, so nothing is created until
 * unlock() is called from a user gesture. If the browser refuses to create a
 * context, the manager stays silent instead of throwing.
 *
 * Exported for tests; the app uses the `audioManager` singleton.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private pad: AmbientPad | null = null;

  private track: Howl | null = null;
  private trackReady = false;

  private unlocked = false;
  private contextFailed = false;
  private musicPlaying = false;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private lastPlayedAt = new Map<SfxName, number>();

  /** Call from a user gesture (pointerdown / keydown). Safe to call many times. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.unlocked = true;
    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(() => this.syncMusic())
        .catch(() => undefined);
    } else {
      this.syncMusic();
    }
  }

  applySettings(next: AudioSettings): void {
    this.settings = {
      muted: next.muted,
      musicEnabled: next.musicEnabled,
      masterVolume: next.masterVolume,
      musicVolume: next.musicVolume,
      sfxVolume: next.sfxVolume,
    };
    this.applyGains();
    if (this.track) {
      this.track.mute(this.settings.muted);
      if (this.musicPlaying && this.trackReady) this.track.volume(mixFor(this.settings).track);
    }
    this.syncMusic();
  }

  play(name: SfxName, options: SfxOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noise || ctx.state === "closed") return;
    if (effectiveSfxGain(this.settings) <= 0) return;

    const recipe = SFX_RECIPES[name];
    const now = performance.now();
    const last = this.lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY;
    if (now - last < recipe.minIntervalMs) return;
    this.lastPlayedAt.set(name, now);

    recipe.play({
      ctx,
      out: this.sfxBus,
      time: ctx.currentTime + 0.01,
      noise: this.noise,
      pitch: options.pitch ?? 1,
      gain: options.volume ?? 1,
    });
  }

  /** Use a file for background music instead of the synth pad. Pass null to go back. */
  setMusicTrack(src: string | null): void {
    const wasPlaying = this.musicPlaying;
    if (wasPlaying) {
      this.stopMusic();
      this.musicPlaying = false;
    }

    this.track?.unload();
    this.track = null;
    this.trackReady = false;

    if (src) {
      const howl = new Howl({
        src: [src],
        loop: true,
        volume: 0,
        mute: this.settings.muted,
        onload: () => {
          if (this.track !== howl) return;
          this.trackReady = true;
          if (this.musicPlaying) {
            this.pad?.stop(MUSIC_FADE_SEC);
            this.playTrack();
          }
        },
        onloaderror: () => {
          if (this.track !== howl) return;
          this.track = null;
          this.trackReady = false;
        },
      });
      this.track = howl;
    }

    this.syncMusic();
  }

  /** Pause everything while the tab is hidden. */
  setBackgrounded(hidden: boolean): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed") return;

    if (hidden) {
      ctx.suspend().catch(() => undefined);
      if (this.track?.playing()) this.track.pause();
      return;
    }

    if (!this.unlocked) return;
    ctx
      .resume()
      .then(() => {
        if (this.musicPlaying && this.track && this.trackReady && !this.track.playing()) {
          this.track.play();
        }
      })
      .catch(() => undefined);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    // unlock() runs on every gesture; retrying a failed setup would leak a context each time.
    if (this.contextFailed) return null;
    try {
      return this.createContext();
    } catch (error) {
      this.contextFailed = true;
      console.warn("[audio] Could not start the audio engine; continuing without sound.", error);
      return null;
    }
  }

  private createContext(): AudioContext | null {
    const Ctor: AudioContextCtor | undefined =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
    if (!Ctor) return null;

    const ctx = new Ctor();

    // Gentle glue only: catches a stack of overlapping effects without pumping the music.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 12;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.3;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.connect(compressor);

    const musicBus = ctx.createGain();
    musicBus.connect(master);

    const sfxBus = ctx.createGain();
    sfxBus.connect(master);

    const mix = mixFor(this.settings);
    master.gain.value = mix.master;
    musicBus.gain.value = mix.music;
    sfxBus.gain.value = mix.sfx;

    this.ctx = ctx;
    this.master = master;
    this.musicBus = musicBus;
    this.sfxBus = sfxBus;
    this.noise = createNoiseBuffer(ctx, NOISE_BUFFER_SEC);
    this.pad = createAmbientPad(ctx, musicBus);
    return ctx;
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const mix = mixFor(this.settings);
    this.rampTo(this.master.gain, mix.master);
    this.rampTo(this.musicBus.gain, mix.music);
    this.rampTo(this.sfxBus.gain, mix.sfx);
  }

  private rampTo(param: AudioParam, value: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + GAIN_RAMP_SEC);
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const want = this.settings.musicEnabled;
    if (want === this.musicPlaying) return;
    this.musicPlaying = want;
    if (want) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    if (this.track && this.trackReady) this.playTrack();
    else this.pad?.start(MUSIC_FADE_SEC);
  }

  private stopMusic(): void {
    this.pad?.stop(MUSIC_FADE_SEC);
    const track = this.track;
    if (track?.playing()) {
      track.fade(track.volume(), 0, MUSIC_FADE_SEC * 1000);
      track.once("fade", () => {
        if (!this.musicPlaying) track.pause();
      });
    }
  }

  private playTrack(): void {
    const track = this.track;
    if (!track) return;
    if (!track.playing()) track.play();
    track.fade(0, mixFor(this.settings).track, MUSIC_FADE_SEC * 1000);
  }
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export const audioManager = new AudioManager();
